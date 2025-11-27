import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { Tab, Tabs } from "../Header";
import { H3, P, PSmall } from "../uikit/text";
import CreateSell from "./CreateSell";
import CreateBuy from "./CreateBuy";
import { Order } from "./Order";
import otc from "./otc";

const OtcMarket = () => {
  return (
    <Main>
      <Content>
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <H3>
            GONKA AI <span style={{ fontSize: 14, color: "#bcbcbc" }}>OTC Market</span>
          </H3>
        </div>
      </Content>

      <Content style={{ marginTop: 32 }}>
        <Tabs style={{ width: "100%" }}>
          <Tab $active>
            <P>Orderbook</P>
          </Tab>
          <Tab>
            <P>My open orders</P>
          </Tab>
          <Tab>
            <P>Orders History</P>
          </Tab>
        </Tabs>
      </Content>

      <Content style={{ marginTop: 32 }}>
        <div style={{ flex: 1, width: 600 }}>
          <CreateSell />

          <TableHeader>
            <PSmall>Seller</PSmall>
            <PSmall>Price</PSmall>
            <PSmall>Amount</PSmall>
            <PSmall>Amount (USD)</PSmall>
            <div />
          </TableHeader>

          {otc.orders.ask.map((order) => (
            <Order key={order.params.salt} order={order} type="ask" />
          ))}
        </div>

        <div style={{ flex: 1, width: 600 }}>
          <CreateBuy />

          <TableHeader>
            <PSmall>Buyer</PSmall>
            <PSmall>Price</PSmall>
            <PSmall>Amount</PSmall>
            <PSmall>Amount (USD)</PSmall>
            <div />
          </TableHeader>

          {otc.orders.bid.map((order) => (
            <Order key={order.params.salt} order={order} type="bid" />
          ))}
        </div>
      </Content>
    </Main>
  );
};

const Main = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

const Content = styled.div`
  display: flex;
  max-width: 1200px;
  width: 100%;
  gap: 24px;
`;

export const TableHeader = styled.div`
  display: grid;
  width: 100%;
  margin-top: 16px;
  background: var(--surface-common-container--low, #212125);
  grid-template-columns: 2fr 2fr 2fr 2fr 1fr;
  padding: 12px;
  gap: 12px;
`;

export default observer(OtcMarket);
