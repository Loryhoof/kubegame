import React from "react";
import ReactDOM from "react-dom/client";
import Main from "./Main";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
);
