import * as request from 'request';
import { session } from 'electron';
import 'url';
import * as _ from 'lodash';

interface GetOptions {
  headers?: any;
  updateCookies?: boolean;
  requestOptions?: request.CoreOptions;
  skipCookies?: boolean;
}

interface PostOptions extends GetOptions {
  data: any;
  type?: 'form' | 'multipart' | 'json';
}

interface HttpResponse<T> {
  body: T;
  error: any;
  response: request.Response;
  returnUrl: string;
}

export default class Http {
  static Request = request.defaults({
    headers: {
      'User-Agent': session.defaultSession.getUserAgent(),
    },
  });

  static parseCookies(cookies: Electron.Cookie[]) {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  static async retrieveCookies(
    uri: string,
    ses: Electron.Session,
    cookies?: string,
  ): Promise<string> {
    if (cookies) {
      return cookies;
    }

    const sessionCookies = await ses.cookies.get({
      url: new URL(uri).origin,
    });

    return Http.parseCookies(sessionCookies);
  }

  static async get<T>(
    uri: string,
    partitionId: string,
    options: GetOptions = {},
  ): Promise<HttpResponse<T>> {
    const ses = session.fromPartition(`persist:${partitionId}`);

    const headers = options.headers || {};
    if (!options.skipCookies) {
      headers.cookie = await Http.retrieveCookies(uri, ses, headers.cookie);
    }

    const opts: request.CoreOptions = Object.assign(
      {
        headers,
      },
      options.requestOptions,
    );
    return new Promise(resolve => {
      Http.Request.get(uri, opts, (error, response, body) => {
        const res: HttpResponse<T> = {
          response,
          error,
          body,
          returnUrl: _.get(response, 'request.uri.href'),
        };
        resolve(res);
      });
    });
  }

  static async post<T>(
    uri: string,
    partitionId: string,
    options: PostOptions,
  ): Promise<HttpResponse<T>> {
    const ses = session.fromPartition(`persist:${partitionId}`);

    const headers = options.headers || {};
    if (!options.skipCookies) {
      headers.cookie = await Http.retrieveCookies(uri, ses, headers.cookie);
    }

    const opts: request.CoreOptions = Object.assign(
      {
        headers,
      },
      options.requestOptions,
    );

    if (options.type === 'json') {
      opts.body = options.data;
      opts.json = true;
    } else if (options.type === 'multipart') {
      opts.formData = options.data;
    } else if (options.type === 'form') {
      opts.form = options.data;
    } else {
      opts.body = options.data;
    }

    return new Promise(resolve => {
      Http.Request.post(uri, opts, (error, response, body) => {
        const res: HttpResponse<T> = {
          error,
          response,
          body,
          returnUrl: _.get(response, 'request.uri.href'),
        };
        resolve(res);
      });
    });
  }
}
