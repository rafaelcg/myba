type Handler = (request: Request, params?: Record<string, string>) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
  paramNames: string[];
}

export class Router {
  private routes: Route[] = [];

  private addRoute(method: string, path: string, handler: Handler) {
    // Convert /:id to regex
    const paramNames: string[] = [];
    const pattern = path.replace(/:([^/]+)/g, (match, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${pattern}$`),
      handler,
      paramNames,
    });
  }

  get(path: string, handler: Handler) { this.addRoute('GET', path, handler); }
  post(path: string, handler: Handler) { this.addRoute('POST', path, handler); }
  put(path: string, handler: Handler) { this.addRoute('PUT', path, handler); }
  delete(path: string, handler: Handler) { this.addRoute('DELETE', path, handler); }

  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    for (const route of this.routes) {
      if (route.method !== method) continue;
      
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        
        return await route.handler(request, params);
      }
    }

    return null;
  }
}