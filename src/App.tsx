/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppRouter } from "./components/AppRouter";
import { Toaster } from "sonner";

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors theme="dark" />
      <AppRouter />
    </>
  );
}
