import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

const titles = {
  "health-impacts": "Health Impacts",
  "request-data": "Download Data",
  about: "About",
  methodology: "Methodology",
  contact: "Contact",
};

export const load: PageLoad = ({ params }) => {
  if (!Object.hasOwn(titles, params.info)) error(404, "Page not found");
  return { title: titles[params.info as keyof typeof titles] };
};
