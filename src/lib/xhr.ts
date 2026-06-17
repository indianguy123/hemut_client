/**
 * Raw XMLHttpRequest utility.
 *
 * This module handles the HTTP request lifecycle directly using XHR,
 * demonstrating mastery of: open → setRequestHeader → send,
 * and all event handlers: onload, onerror, ontimeout, onabort, upload.onprogress.
 *
 * CONSTRAINT: The assignment requires raw XMLHttpRequest (NOT fetch or axios).
 */

export interface XHROptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  onProgress?: (event: ProgressEvent) => void;
  onAbort?: () => void;
  onUploadProgress?: (event: ProgressEvent) => void;
}

export interface XHRResponse<T = unknown> {
  status: number;
  statusText: string;
  data: T;
  headers: string;
}

export interface XHRError {
  type: 'network' | 'timeout' | 'abort' | 'http' | 'parse';
  status?: number;
  message: string;
  response?: unknown;
}

export interface XHRHandle<T = unknown> {
  promise: Promise<XHRResponse<T>>;
  abort: () => void;
  xhr: XMLHttpRequest;
}

/**
 * Make an HTTP request using raw XMLHttpRequest.
 * Returns a handle with the promise, abort function, and raw XHR object.
 */
export function xhrRequest<T = unknown>(options: XHROptions): XHRHandle<T> {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<XHRResponse<T>>((resolve, reject) => {
    // 1. Open the connection
    xhr.open(options.method, options.url, true);

    // 2. Set request headers
    // Always set Content-Type for JSON unless sending FormData
    if (options.body && !(options.body instanceof FormData)) {
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    // Set custom headers (e.g., Authorization)
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    // 3. Configure timeout
    if (options.timeout) {
      xhr.timeout = options.timeout;
    }

    // 4. Event handlers — demonstrating full XHR lifecycle

    // onload: fires when the request completes (regardless of status code)
    xhr.onload = () => {
      let data: T;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : (null as T);
      } catch {
        // If response is not JSON, return raw text
        data = xhr.responseText as unknown as T;
      }

      const response: XHRResponse<T> = {
        status: xhr.status,
        statusText: xhr.statusText,
        data,
        headers: xhr.getAllResponseHeaders(),
      };

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(response);
      } else {
        const error: XHRError = {
          type: 'http',
          status: xhr.status,
          message: `HTTP ${xhr.status}: ${xhr.statusText}`,
          response: data,
        };
        reject(error);
      }
    };

    // onerror: fires on network-level failure (DNS, CORS, no connection)
    xhr.onerror = () => {
      const error: XHRError = {
        type: 'network',
        message: 'Network error — check your connection',
      };
      reject(error);
    };

    // ontimeout: fires when the request exceeds the configured timeout
    xhr.ontimeout = () => {
      const error: XHRError = {
        type: 'timeout',
        message: `Request timed out after ${options.timeout}ms`,
      };
      reject(error);
    };

    // onabort: fires when xhr.abort() is called
    xhr.onabort = () => {
      if (options.onAbort) {
        options.onAbort();
      }
      const error: XHRError = {
        type: 'abort',
        message: 'Request was aborted',
      };
      reject(error);
    };

    // Download progress tracking
    if (options.onProgress) {
      xhr.onprogress = options.onProgress;
    }

    // Upload progress tracking (e.g., file uploads, large POST bodies)
    if (options.onUploadProgress) {
      xhr.upload.onprogress = options.onUploadProgress;
    }

    // 5. Send the request
    if (options.body) {
      if (options.body instanceof FormData) {
        xhr.send(options.body);
      } else {
        xhr.send(JSON.stringify(options.body));
      }
    } else {
      xhr.send();
    }
  });

  return {
    promise,
    abort: () => xhr.abort(),
    xhr,
  };
}

/**
 * Convenience wrapper for GET requests.
 */
export function xhrGet<T = unknown>(url: string, headers?: Record<string, string>): XHRHandle<T> {
  return xhrRequest<T>({ method: 'GET', url, headers });
}

/**
 * Convenience wrapper for POST requests.
 */
export function xhrPost<T = unknown>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): XHRHandle<T> {
  return xhrRequest<T>({ method: 'POST', url, body, headers });
}

/**
 * Convenience wrapper for PATCH requests.
 */
export function xhrPatch<T = unknown>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): XHRHandle<T> {
  return xhrRequest<T>({ method: 'PATCH', url, body, headers });
}

/**
 * Convenience wrapper for DELETE requests.
 */
export function xhrDelete<T = unknown>(
  url: string,
  headers?: Record<string, string>
): XHRHandle<T> {
  return xhrRequest<T>({ method: 'DELETE', url, headers });
}
