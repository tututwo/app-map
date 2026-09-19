// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare namespace App {
  // interface Error {}
  // interface Locals {}
  // interface PageData {}
  // interface PageState {}
  interface Platform {
    env: Cloudflare.Env;
    ctx: ExecutionContext;
    caches: CacheStorage;
  }
}

declare module "*.csv" {
  const content: any[];
  export default content;
}
