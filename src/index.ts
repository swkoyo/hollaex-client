import axios, { AxiosInstance, Method } from 'axios';
import moment from 'moment';
import crypto from 'crypto';
import qs from 'qs';
import _ from 'lodash';
import WebSocket from 'ws';
import { setWsHeartbeat } from 'ws-heartbeat/client';

interface Websocket extends WebSocket {
	_events?: object;
}

type OrderSide = 'buy' | 'sell';
type OrderType = 'limit' | 'market';

interface CancelOrdersOpts {
	symbol: string;
}

interface CreateOrderConfig {
	symbol: string;
	size: number;
	side: OrderSide;
	type: OrderType;
	price?: number;
}

interface MarketOrderOpts {
	note?: string;
}

interface CreateOrderOpts extends MarketOrderOpts {
	stopPrice?: number;
	postOnly?: boolean;
}

interface AuthHeaders {
	'api-key': string;
	'api-expires': number;
	'api-signature': string;
}

interface RequestConfig {
	method: Method | 'connect';
	path: string;
	params?: object;
	data?: object;
}

interface ClientConfig {
	apiUrl?: string;
	apiKey?: string;
	secret?: string;
	expires?: number;
	version?: number;
}

interface BasicQueryParams {
	limit?: number;
	page?: number;
	orderBy?: string;
	order?: 'asc' | 'desc';
	startDate?: Date | 'string';
	endDate?: Date | 'string';
}

interface TransactionsQueryParams extends BasicQueryParams {
	currency?: string;
	status?: boolean;
	dismissed?: boolean;
	rejected?: boolean;
	processing?: boolean;
	waiting?: boolean;
	transactionId?: string;
	address?: string;
}

interface TradesQueryParams extends BasicQueryParams {
	symbol?: string;
}

interface OrdersQueryParmas extends BasicQueryParams {
	symbol?: string;
	side?: OrderSide;
	status?: 'new' | 'pfilled' | 'filled' | 'canceled';
	open?: boolean;
}

interface CreateSignatureOpts {
	data?: object;
	params?: object;
}

export class Client {
	private readonly apiUrl: string;
	private readonly apiKey: string;
	private readonly secret: string;
	private readonly expires: number;
	private readonly instance: AxiosInstance;
	ws?: Websocket;
	private readonly wsUrl: string;
	private wsEvents: string[];
	private wsReconnect: boolean;
	private wsReconnectInterval: number;
	private wsEventListeners?: object;
	private initialConnection?: boolean;

	constructor(params: ClientConfig) {
		this.apiUrl = params.apiUrl || 'https://api.hollaex.com/v2';
		this.apiKey = params.apiKey || '';
		this.secret = params.secret || '';
		this.expires = params.expires || 60;
		this.instance = axios.create({
			baseURL: this.apiUrl
		});
		this.wsUrl = `wss://${this.apiUrl.split('/')[2]}/stream`;
		this.wsEvents = [];
		this.wsReconnect = true;
		this.wsReconnectInterval = 5000;
	}

	private getFullUrl(path: string, params?: object): string {
		if (params) {
			params = _.mapKeys(params, (value, key) => _.snakeCase(key));
		}
		return `${path.includes('/stream') ? this.wsUrl : this.apiUrl}${path}${
			params ? qs.stringify(params, { addQueryPrefix: true }) : ''
		}`;
	}

	private createHmacSignature(
		method: Method | 'connect',
		path: string,
		expires: number,
		opts?: CreateSignatureOpts
	): string {
		const formattedString = `${method.toUpperCase()}${this.getFullUrl(
			path,
			opts?.params
		)}${expires}${opts?.data ? JSON.stringify(opts.data) : ''}`;

		const signature = crypto
			.createHmac('sha256', this.secret)
			.update(formattedString)
			.digest('hex');

		return signature;
	}

	private generateAuthHeaders(requestData: RequestConfig): AuthHeaders {
		const expires = moment().unix() + this.expires;
		const { method, path, params, data } = requestData;

		const headers = {
			'api-key': this.apiKey,
			'api-expires': expires,
			'api-signature': this.createHmacSignature(method, path, expires, {
				params,
				data
			})
		};

		return headers;
	}

	async getKit(): Promise<object> {
		const { data } = await this.instance.get('/kit');
		return data;
	}

	async getTicker(symbol: string): Promise<object> {
		const { data } = await this.instance.get('/ticker', {
			params: { symbol }
		});
		return data;
	}

	async getTickers(): Promise<object> {
		const { data } = await this.instance.get('/tickers');
		return data;
	}

	async getOrderbook(symbol: string): Promise<object> {
		const { data } = await this.instance.get('/orderbook', {
			params: { symbol }
		});
		return data;
	}

	async getOrderbooks(): Promise<object> {
		const { data } = await this.instance.get('/orderbooks');
		return data;
	}

	async getPublicTrades(symbol?: string): Promise<object> {
		const { data } = await this.instance.get('/trades', {
			params: { symbol }
		});
		return data;
	}

	async getConstants(): Promise<object> {
		const { data } = await this.instance.get('/constants');
		return data;
	}

	async getUserInfo(): Promise<object> {
		const { data } = await this.instance.get('/user', {
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user'
			})
		});
		return data;
	}

	async getUserBalance(): Promise<object> {
		const { data } = await this.instance.get('/user/balance', {
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user/balance'
			})
		});
		return data;
	}

	async getUserDeposits(params?: TransactionsQueryParams): Promise<object> {
		if (params) {
			params = _.mapKeys(params, (value, key) => _.snakeCase(key));
		}
		const { data } = await this.instance.get('/user/deposits', {
			params,
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user/deposits',
				params
			})
		});
		return data;
	}

	async getUserWithdrawals(
		params?: TransactionsQueryParams
	): Promise<object> {
		if (params) {
			params = _.mapKeys(params, (value, key) => _.snakeCase(key));
		}
		const { data } = await this.instance.get('/user/withdrawals', {
			params,
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user/withdrawals',
				params
			})
		});
		return data;
	}

	async getUserTrades(params?: TradesQueryParams): Promise<object> {
		if (params) {
			params = _.mapKeys(params, (value, key) => _.snakeCase(key));
		}
		const { data } = await this.instance.get('/user/trades', {
			params,
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user/trades',
				params
			})
		});
		return data;
	}

	async getUserOrders(params?: OrdersQueryParmas): Promise<object> {
		if (params) {
			params = _.mapKeys(params, (value, key) => _.snakeCase(key));
		}
		const { data } = await this.instance.get('/orders', {
			params,
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/orders',
				params
			})
		});
		return data;
	}

	async getOrder(orderId: string): Promise<object> {
		const params = { order_id: orderId };
		const { data } = await this.instance.get('/order', {
			params,
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/order',
				params
			})
		});
		return data;
	}

	async createOrder(
		config: CreateOrderConfig,
		opts?: CreateOrderOpts
	): Promise<object> {
		const { symbol, side, size, price, type } = config;
		const requestData = {
			symbol,
			side,
			size,
			type,
			price,
			stop: opts?.stopPrice,
			meta: {
				post_only: opts?.postOnly,
				note: opts?.note
			}
		};
		const { data } = await this.instance.post('/order', requestData, {
			headers: this.generateAuthHeaders({
				method: 'post',
				path: '/order',
				data: requestData
			})
		});
		return data;
	}

	async createLimitOrder(
		side: OrderSide,
		symbol: string,
		size: number,
		price: number,
		opts?: CreateOrderOpts
	): Promise<object> {
		return this.createOrder(
			{
				type: 'limit',
				side,
				symbol,
				size,
				price
			},
			opts
		);
	}

	async createLimitBuyOrder(
		symbol: string,
		size: number,
		price: number,
		opts?: CreateOrderOpts
	): Promise<object> {
		return this.createLimitOrder('buy', symbol, size, price, opts);
	}

	async createLimitSellOrder(
		symbol: string,
		size: number,
		price: number,
		opts?: CreateOrderOpts
	): Promise<object> {
		return this.createLimitOrder('sell', symbol, size, price, opts);
	}

	async createMarketOrder(
		side: OrderSide,
		symbol: string,
		size: number,
		opts?: MarketOrderOpts
	): Promise<object> {
		return this.createOrder(
			{
				type: 'market',
				side,
				symbol,
				size
			},
			opts
		);
	}

	async createMarketBuyOrder(
		symbol: string,
		size: number,
		opts?: MarketOrderOpts
	): Promise<object> {
		return this.createMarketOrder('buy', symbol, size, opts);
	}

	async createMarketSellOrder(
		symbol: string,
		size: number,
		opts?: MarketOrderOpts
	): Promise<object> {
		return this.createMarketOrder('sell', symbol, size, opts);
	}

	async cancelOrder(orderId: string): Promise<object> {
		const params = { order_id: orderId };
		const { data } = await this.instance.delete('/order', {
			params,
			headers: this.generateAuthHeaders({
				method: 'delete',
				path: '/order',
				params
			})
		});
		return data;
	}

	async cancelOrders(opts?: CancelOrdersOpts): Promise<object> {
		const params = { symbol: opts?.symbol };
		const { data } = await this.instance.delete('/order', {
			params,
			headers: this.generateAuthHeaders({
				method: 'delete',
				path: '/order/all',
				params
			})
		});
		return data;
	}

	wsConnected(): boolean {
		return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
	}

	wsConnect(events: string[]) {
		this.initialConnection = true;
		this.wsReconnect = true;
		this.wsEvents = events;
		let url = this.wsUrl;
		if (this.apiKey && this.secret) {
			url = `${url}?${qs.stringify(
				this.generateAuthHeaders({
					method: 'connect',
					path: '/stream'
				}),
				{ addQueryPrefix: true }
			)}`;
		}
		this.ws = new WebSocket(url);

		this.ws.on('unexpected-response', () => {
			if (this.ws?.readyState !== WebSocket.CLOSING) {
				if (this.ws?.readyState === WebSocket.OPEN) {
					this.ws.close();
				} else if (this.wsReconnect) {
					this.wsEventListeners = this.ws?._events;
					this.ws = undefined;
					setTimeout(() => {
						this.wsConnect(this.wsEvents);
					}, this.wsReconnectInterval);
				} else {
					this.wsEventListeners = undefined;
					this.ws = undefined;
				}
			}
		});

		this.ws.on('error', () => {
			if (this.ws?.readyState !== WebSocket.CLOSING) {
				if (this.ws?.readyState === WebSocket.OPEN) {
					this.ws.close();
				} else if (this.wsReconnect) {
					this.wsEventListeners = this.ws?._events;
					this.ws = undefined;
					setTimeout(() => {
						this.wsConnect(this.wsEvents);
					}, this.wsReconnectInterval);
				} else {
					this.wsEventListeners = undefined;
					this.ws = undefined;
				}
			}
		});

		this.ws.on('close', () => {
			if (this.wsReconnect) {
				this.wsEventListeners = this.ws?._events;
				this.ws = undefined;
				setTimeout(() => {
					this.wsConnect(this.wsEvents);
				}, this.wsReconnectInterval);
			} else {
				this.wsEventListeners = undefined;
				this.ws = undefined;
			}
		});

		this.ws.on('open', () => {
			if (this.wsEvents.length > 0) {
				this.subscribe(this.wsEvents);
			}

			this.initialConnection = false;
			// @ts-ignore
			setWsHeartbeat(this.ws, JSON.stringify({ op: 'ping' }), {
				pingTimeout: 60000,
				pingInterval: 25000
			});
		});
	}

	disconnect() {
		if (this.wsConnected()) {
			this.wsReconnect = false;
			this.ws?.close();
		} else {
			throw new Error('Websocket not connected');
		}
	}

	subscribe(events: string[] = []) {
		if (this.wsConnected()) {
			for (const event of events) {
				if (!this.wsEvents.includes(event) || this.initialConnection) {
					const [topic, symbol] = event.split(':');
					switch (topic) {
						case 'orderbook':
						case 'trade':
							if (symbol) {
								if (!this.wsEvents.includes(topic)) {
									this.ws?.send(
										JSON.stringify({
											op: 'subscribe',
											args: [`${topic}:${symbol}`]
										})
									);
									if (!this.initialConnection) {
										this.wsEvents = _.union(this.wsEvents, [
											event
										]);
									}
								}
							} else {
								this.ws?.send(
									JSON.stringify({
										op: 'subscribe',
										args: [topic]
									})
								);
								if (!this.initialConnection) {
									this.wsEvents = _.union(this.wsEvents, [
										event
									]);
								}
							}
							break;
						case 'order':
						case 'wallet':
						case 'deposit':
							this.ws?.send(
								JSON.stringify({
									op: 'subscribe',
									args: [topic]
								})
							);
							if (!this.initialConnection) {
								this.wsEvents = _.union(this.wsEvents, [event]);
							}
							break;
						default:
							break;
					}
				}
			}
		} else {
			throw new Error('Websocket not connected');
		}
	}

	unsubscribe(events: string[] = []) {
		if (this.wsConnected()) {
			for (const event of events) {
				if (this.wsEvents.includes(event)) {
					const [topic, symbol] = event.split(':');
					switch (topic) {
						case 'orderbook':
						case 'trade':
							if (symbol) {
								this.ws?.send(
									JSON.stringify({
										op: 'unsubscribe',
										args: [`${topic}:${symbol}`]
									})
								);
							} else {
								this.ws?.send(
									JSON.stringify({
										op: 'unsubscribe',
										args: [topic]
									})
								);
							}
							this.wsEvents = this.wsEvents.filter(
								(e) => e !== event
							);
							break;
						case 'order':
						case 'wallet':
						case 'deposit':
							this.ws?.send(
								JSON.stringify({
									op: 'unsubscribe',
									args: [topic]
								})
							);
							this.wsEvents = this.wsEvents.filter(
								(e) => e !== event
							);
							break;
						default:
							break;
					}
				}
			}
		} else {
			throw new Error('Websocket not connected');
		}
	}
}
