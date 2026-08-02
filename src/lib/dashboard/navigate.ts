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
