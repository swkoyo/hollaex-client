import axios, { AxiosInstance } from 'axios';
import moment from 'moment';
import crypto from 'crypto';
import qs from 'qs';
import _ from 'lodash';

type RequestMethod = 'get' | 'post' | 'put' | 'delete';
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
	method: RequestMethod;
	path: string;
	params?: object;
	data?: object;
}

interface ClientConfig {
	apiUrl?: string;
	apiKey?: string;
	secret?: string;
	expires?: number;
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

export default class Client {
	private readonly apiUrl: string;
	private readonly apiKey: string;
	private readonly secret: string;
	private readonly expires: number;
	private readonly instance: AxiosInstance;

	constructor(params: ClientConfig) {
		this.apiUrl = params.apiUrl || 'https://api.hollaex.com/v2';
		this.apiKey = params.apiKey || '';
		this.secret = params.secret || '';
		this.expires = params.expires || 60;
		this.instance = axios.create({
			baseURL: this.apiUrl
		});
	}

	private getFullUrl(path: string, params?: object): string {
		if (params) {
			params = _.mapKeys(params, (value, key) => _.snakeCase(key));
		}
		return `${this.apiUrl}${path}${
			params ? qs.stringify(params, { addQueryPrefix: true }) : ''
		}`;
	}

	private generateAuthHeaders(requestData: RequestConfig): AuthHeaders {
		const expires = moment().unix() + this.expires;
		const { method, path, params, data } = requestData;
		const formattedString = `${method.toUpperCase()}${this.getFullUrl(
			path,
			params
		)}${expires}${data ? JSON.stringify(data) : ''}`;

		const signature = crypto
			.createHmac('sha256', this.secret)
			.update(formattedString)
			.digest('hex');

		const headers = {
			'api-key': this.apiKey,
			'api-expires': expires,
			'api-signature': signature
		};

		return headers;
	}

	async getKit() {
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

	async getPublicTrades(symbol?: string) {
		const { data } = await this.instance.get('/trades', {
			params: { symbol }
		});
		return data;
	}

	async getConstants() {
		const { data } = await this.instance.get('/constants');
		return data;
	}

	async getUserInfo() {
		const { data } = await this.instance.get('/user', {
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user'
			})
		});
		return data;
	}

	async getUserBalance() {
		const { data } = await this.instance.get('/user/balance', {
			headers: this.generateAuthHeaders({
				method: 'get',
				path: '/user/balance'
			})
		});
		return data;
	}

	async getUserDeposits(params?: TransactionsQueryParams) {
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

	async getUserWithdrawals(params?: TransactionsQueryParams) {
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

	async getUserTrades(params?: TradesQueryParams) {
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

	async getUserOrders(params?: OrdersQueryParmas) {
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

	async getOrder(orderId: string) {
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

	async createOrder(config: CreateOrderConfig, opts?: CreateOrderOpts) {
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
	) {
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
	) {
		return this.createLimitOrder('buy', symbol, size, price, opts);
	}

	async createLimitSellOrder(
		symbol: string,
		size: number,
		price: number,
		opts?: CreateOrderOpts
	) {
		return this.createLimitOrder('sell', symbol, size, price, opts);
	}

	async createMarketOrder(
		side: OrderSide,
		symbol: string,
		size: number,
		opts?: MarketOrderOpts
	) {
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
	) {
		return this.createMarketOrder('buy', symbol, size, opts);
	}

	async createMarketSellOrder(
		symbol: string,
		size: number,
		opts?: MarketOrderOpts
	) {
		return this.createMarketOrder('sell', symbol, size, opts);
	}

	async cancelOrder(orderId: string) {
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

	async cancelOrders(opts?: CancelOrdersOpts) {
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
}
