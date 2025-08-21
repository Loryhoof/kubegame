import React from "react";
import ReactDOM from "react-dom/client";
import Main from "./Main";
import { Analytics } from "@vercel/analytics/react";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <Analytics />
    <Main />
  </React.StrictMode>
);
