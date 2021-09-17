import axios, { AxiosInstance } from 'axios';
import { generateQueryString } from './helpers';

interface ClientParams {
	apiUrl?: string;
	apiKey?: string;
	apiSecret?: string;
	apiExpiresAfter?: number;
}

export default class Client {
	apiUrl: string;
	apiKey?: string;
	apiSecret?: string;
	apiExpiresAfter: number;
	instance: AxiosInstance;

	constructor(params: ClientParams) {
		this.apiUrl = params.apiUrl || 'https://api.hollaex.com/v2';
		this.apiKey = params.apiKey;
		this.apiSecret = params.apiSecret;
		this.apiExpiresAfter = params.apiExpiresAfter || 60;
		this.instance = axios.create({
			baseURL: this.apiUrl
		});
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
}
