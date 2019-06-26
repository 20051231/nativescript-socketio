import { Common } from './socketio.common';

declare var SocketManager: any, NSURLComponents: any, NSURL: any, NSArray: any,
    NSDictionary: any, NSNull: any, SocketIOStatus: any, NSHTTPCookie: any, NSHTTPCookieSecure: any,
    NSHTTPCookiePath: any, NSHTTPCookieDomain: any, NSHTTPCookieExpires: any,
    NSHTTPCookieMaximumAge: any, NSHTTPCookieName: any, NSHTTPCookieValue: any;

export class SocketIO extends Common {
    protected socket: any;
    manager: any;

    /**
     * Class Constructor
     * args[0]: Connection URL as String
     * args[1]: Connection Options
     */
    constructor(...args: any[]) {
        super();

        let opts = {} as any;
        let urlComponent;
        let count;
        let connectParams = {};
        switch (args.length) {
            case 2:
                urlComponent = NSURLComponents.alloc().initWithString(args[0]);
                const obj = args[1];
                const keys = Object.keys(obj);

                count = urlComponent.queryItems ? urlComponent.queryItems.count : 0;
                for (let i = 0; i < count; i++) {
                    const component = urlComponent.queryItems.objectAtIndex(i);
                    const componentObj = {};
                    componentObj[component.name] = component.value;
                    Object.assign(connectParams, componentObj);
                }

                keys.forEach((key) => {
                    if (key === 'query') {
                        let query = obj[key];
                        if (typeof query === 'object') {
                            const queryKeys = Object.keys(query);
                            for (let queryKey of queryKeys) {
                                const value = query[queryKey];
                                Object.assign(connectParams, {
                                    [queryKey]: value
                                });
                            }
                        } else if (typeof query === 'string') {
                            if (query.startsWith('?')) {
                                query = query.replace('?', '');
                            }

                            const optionsQuery = query
                                .split('&')
                                .map(p => p.split('='))
                                .reduce((obj, pair) => {
                                    const [key, value] = pair.map(decodeURIComponent);
                                    return ({...obj, [key]: value});
                                }, {});

                            Object.assign(connectParams, optionsQuery);

                        }
                    } else if (key === 'debug' && obj[key]) {
                        opts['log'] = true;
                    } else if (key === 'cookie') {
                        const cookie = obj[key] as string;
                        const properties = {};
                        properties[NSHTTPCookiePath] = '/';
                        properties[NSHTTPCookieDomain] = (urlComponent.scheme || '') + '://' + (urlComponent.host || '');
                        cookie.split(';').forEach((item, index) => {
                            if (item.trim() === 'Secure') {
                                properties[NSHTTPCookieSecure] = true;
                            } else if (item.trim() === 'HttpOnly') {

                            } else {
                                const keyVal = item.trim();
                                if (item.indexOf('=') > -1) {
                                    const keyValItems = keyVal.split('=');
                                    const key = keyValItems[0];
                                    const val = keyValItems[1];
                                    if (index === 0) {
                                        properties[NSHTTPCookieName] = key;
                                        properties[NSHTTPCookieValue] = val;
                                    } else {
                                        switch (key) {
                                            case 'path':
                                            case 'Path':
                                                properties[NSHTTPCookiePath] = val;
                                                break;
                                            case 'domain':
                                            case 'Domain':
                                                properties[NSHTTPCookieDomain] = val;
                                                break;
                                            case 'expires':
                                            case 'Expires':
                                                properties[NSHTTPCookieExpires] = val;
                                                break;
                                            case 'max-age':
                                            case 'Max-Age':
                                                properties[NSHTTPCookieMaximumAge] = val;
                                                break;
                                            default:

                                        }
                                    }
                                }
                            }
                        });
                        const props = NSDictionary.dictionaryWithDictionary(properties);
                        const native_cookie = NSHTTPCookie.cookieWithProperties(props);
                        if (native_cookie) {
                            opts['cookies'] = NSArray.arrayWithObject(native_cookie);
                        }
                    } else if (key === 'transports') {
                        const transports = obj[key];
                        if (Array.isArray(transports) && transports.length === 1) {
                            if (transports.indexOf('websocket') > -1) {
                                opts['forceWebsockets'] = true;
                            } else if (transports.indexOf('polling') > -1) {
                                opts['forcePolling'] = true;
                            }
                        }
                    } else {
                        opts[key] = serialize(obj[key]);
                    }
                });
                if (opts.connectParams === null) {
                    delete opts.connectParams;
                }

                Object.assign(opts, {connectParams: connectParams});

                this.manager = SocketManager.alloc().initWithSocketURLConfig(NSURL.URLWithString(args[0]),
                    opts);
                this.socket = this.manager.defaultSocket;
                break;
            case 3:
                const s = args.pop();
                this.manager = s.manager;
                this.socket = s;
                break;
            default:
                urlComponent = NSURLComponents.alloc().initWithString(args[0]);

                count = urlComponent.queryItems ? urlComponent.queryItems.count : 0;
                for (let i = 0; i < count; i++) {
                    const component = urlComponent.queryItems.objectAtIndex(i);
                    const componentObj = {};
                    componentObj[component.name] = component.value;
                    Object.assign(connectParams, componentObj);
                }

                if (urlComponent.queryItems) {
                    Object.assign(opts, {
                        connectParams: connectParams
                    });
                }

                this.manager = SocketManager.alloc().initWithSocketURLConfig(NSURL.URLWithString(args[0]),
                    opts);
                this.socket = this.manager.defaultSocket;
                break;
        }
    }

    connect() {
        if (!this.connected) {
            this.socket.connect();
        }
    }

    disconnect() {
        this.socket.disconnect();
    }

    get connected(): boolean {
        return this.socket.status === SocketIOStatus.Connected;
    }

    on(event: string, callback: (...payload) => void): () => void {
        const uuid = this.socket.onCallback(event, (data, ack) => {
            const d = deserialize(data);
            if (Array.isArray(d)) {
                data = d[0];
            } else {
                data = d;
            }

            if (ack) {
                callback(data, ack);
            } else {
                callback(data);
            }
        });

        return () => {
            this.socket.offWithId(uuid);
        };
    }

    once(event: string, callback: (...payload) => void): () => void {
        const uuid = this.socket.onceCallback(event, (data, ack) => {
            const d = deserialize(data);
            if (Array.isArray(d)) {
                data = d[0];
            } else {
                data = d;
            }

            if (ack) {
                callback(data, ack);
            } else {
                callback(data);
            }
        });

        return () => {
            this.socket.offWithId(uuid);
        };
    }

    off(event: string) {
        this.socket.off(event);
    }

    emit(event: string, ...payload: any[]): void {
        if (!event) {
            return console.error('Emit Failed: No Event argument');
        }

        // Check for ack callback
        let ack = payload.pop();

        // Remove ack if final argument is not a function
        if (ack && typeof ack !== 'function') {
            payload.push(ack);
            ack = null;
        }

        // Serialize Emit
        const final = (<any>payload).map(serialize);

        if (ack) {
            const _ack = function (args) {
                ack.apply(null, deserialize(args));
            };
            const e = this.socket.emitWithAckWith(event, final) as any;
            if (e) {
                e.timingOutAfterCallback(0, _ack);
            }
        } else {
            // Emit without Ack Callback
            this.socket.emitWith(event, final);
        }
    }

    joinNamespace(nsp: string): SocketIO {
        return new SocketIO(null, null, this.manager.socketForNamespace(nsp));
    }

    leaveNamespace(): void {
        this.socket.leaveNamespace();
    }
}

export function serialize(data: any): any {
    if (data === null || data === undefined) return NSNull.alloc();
    if (typeof data !== 'object') return data;
    //if (Array.isArray(data)) return NSArray.arrayWithArray(data);
    //return NSDictionary.dictionaryWithDictionary(data);

    const json = JSON.stringify(data);
    const buf = new NSString({ string: json }).dataUsingEncoding(NSUTF8StringEncoding)

    // const buf = new Buffer(JSON.stringify(data));
    const dict = NSJSONSerialization.JSONObjectWithDataOptionsError(
        buf,
        null
    );
    
    return dict;
}

export function deserialize(dict): any {
    if (dict instanceof NSNull) {
        return null;
    }
    const data = NSJSONSerialization.dataWithJSONObjectOptionsError(
        dict,
        null
    );
    const ns = NSString.alloc().initWithDataEncoding(
        data,
        NSUTF8StringEncoding
    );
    return JSON.parse(ns.toString());
}


export function connect(uri: string, options?: any): SocketIO {
    let socketio = new SocketIO(uri, options || {});
    socketio.connect();
    return socketio;
}
