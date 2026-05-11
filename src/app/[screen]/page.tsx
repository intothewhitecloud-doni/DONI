import { routeSegments } from "../../lib/prototype/routes";
import { ScreenPage } from "../ScreenPage";

export const dynamicParams = false;

export function generateStaticParams() {
  return routeSegments().map((screen) => ({ screen }));
}

export default function RoutedScreenPage() {
  return <ScreenPage />;
}
