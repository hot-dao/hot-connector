import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { Route, Routes, BrowserRouter } from "react-router";

import Header from "./Header";
import OtcMarket from "./OtcMarket";
import Exchange from "./Exchange";
import NotFound from "./NotFound";

const App = () => {
  return (
    <BrowserRouter>
      <Root>
        <Header />
        <Routes>
          <Route path="/" element={<Exchange />} />
          <Route path="/otc/gonka" element={<OtcMarket />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Root>
    </BrowserRouter>
  );
};

const Root = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--surface-background-container--low, #141518);
  width: 100vw;
  height: 100vh;
`;

export default observer(App);
