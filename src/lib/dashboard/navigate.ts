import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";

export type DashboardParamsUpdate = {
  from?: number;
  to?: number;
  geoid?: string;
};

export type DashboardNavigationOptions = {
  replaceState: true;
  noScroll: true;
  keepFocus: true;
};

export type DashboardGoto = (url: URL, options: DashboardNavigationOptions) => void | Promise<void>;

export type DashboardParamsWriter = (update: DashboardParamsUpdate) => Promise<void>;

type DashboardParamsWriterDependencies = {
  getCurrentUrl: () => URL;
  goto: DashboardGoto;
};

const navigationOptions: DashboardNavigationOptions = {
  replaceState: true,
  noScroll: true,
  keepFocus: true,
};

export function createDashboardParamsWriter({
  getCurrentUrl,
  goto,
}: DashboardParamsWriterDependencies): DashboardParamsWriter {
  let pendingNavigation: { id: symbol; target: URL } | undefined;

  return (update) => {
    const target = new URL(pendingNavigation?.target ?? getCurrentUrl());

    if (update.from !== undefined) target.searchParams.set("from", String(update.from));
    if (update.to !== undefined) target.searchParams.set("to", String(update.to));
    if (update.geoid !== undefined) target.searchParams.set("geoid", update.geoid);

    const id = Symbol("dashboard-navigation");
    pendingNavigation = { id, target: new URL(target) };

    let navigation: Promise<void>;
    try {
      navigation = Promise.resolve(goto(target, navigationOptions));
    } catch (error) {
      if (pendingNavigation?.id === id) pendingNavigation = undefined;
      return Promise.reject(error);
    }

    return navigation.finally(() => {
      if (pendingNavigation?.id === id) pendingNavigation = undefined;
    });
  };
}

// Lazily initialized only in the browser, so the pending-navigation closure is never shared by SSR requests.
let clientWriter: DashboardParamsWriter | undefined;

export function setDashboardParams(update: DashboardParamsUpdate): Promise<void> {
  if (!browser) {
    throw new Error("Dashboard parameters can only be changed in the browser");
  }

  clientWriter ??= createDashboardParamsWriter({ getCurrentUrl: () => page.url, goto });
  return clientWriter(update);
}
