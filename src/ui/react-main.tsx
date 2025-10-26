import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from "react-router-dom";
import Main from "./Main";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <BrowserRouter>
      <Analytics />
      <Main />
    </BrowserRouter>
  </React.StrictMode>
);
