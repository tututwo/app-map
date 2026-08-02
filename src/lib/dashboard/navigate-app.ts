import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import {
  createDashboardParamsWriter,
  type DashboardParamsUpdate,
  type DashboardParamsWriter,
} from "./navigate";

// Lazily initialized only in the browser, so the pending-navigation closure is never shared by SSR requests.
let clientWriter: DashboardParamsWriter | undefined;

function getClientWriter(): DashboardParamsWriter {
  if (!browser) {
    throw new Error("Dashboard parameters can only be changed in the browser");
  }

  clientWriter ??= createDashboardParamsWriter({
    getCurrentUrl: () => page.url,
    goto,
  });

  return clientWriter;
}

export function setDashboardParams(update: DashboardParamsUpdate): Promise<void> {
  return getClientWriter()(update);
}
