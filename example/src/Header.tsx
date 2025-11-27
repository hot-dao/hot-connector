import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { useLocation, useNavigate } from "react-router";

import { formatter } from "./wibe3/omni/token";
import { P, PSmall } from "./uikit/text";
import { wibe3 } from "./engine";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const hexBalance = wibe3.tokens.reduce((acc, token) => {
    return wibe3.wallets.reduce((acc, wallet) => {
      if (token.chain !== -4) return acc;
      return acc + token.float(wibe3.balance(wallet, token)) * token.usd;
    }, acc);
  }, 0);

  const onchainBalance = wibe3.tokens.reduce((acc, token) => {
    return wibe3.wallets.reduce((acc, wallet) => {
      if (token.chain === -4) return acc;
      return acc + token.float(wibe3.balance(wallet, token)) * token.usd;
    }, acc);
  }, 0);

  return (
    <HeaderWrap>
      <img src="/images/logo.svg" alt="HEX" height={28} />

      <Tabs style={{ marginLeft: 32, width: 300 }}>
        <Tab onClick={() => navigate("/")} $active={location.pathname === "/"}>
          <P>Exchange</P>
        </Tab>
        <Tab $active={location.pathname === "/otc/gonka"} onClick={() => navigate("/otc/gonka")}>
          <P>OTC</P>
        </Tab>
      </Tabs>

      <Button style={{ marginLeft: "auto", alignItems: "flex-start" }}>
        <PSmall style={{ fontSize: 12, color: "#bcbcbc" }}>HEX balance</PSmall>
        <PSmall style={{ marginTop: 2, color: "#fff" }}>${formatter.amount(hexBalance, 2)}</PSmall>
      </Button>

      <Button style={{ alignItems: "flex-start" }}>
        <PSmall style={{ fontSize: 12, color: "#bcbcbc" }}>Wallet balance</PSmall>
        <PSmall style={{ marginTop: 2, color: "#fff" }}>${formatter.amount(onchainBalance, 2)}</PSmall>
      </Button>

      <Button onClick={() => wibe3.connect()}>
        <div style={{ display: "flex", gap: 8 }}>
          {wibe3.wallets.map((t, i) => (
            <img src={t.icon} style={{ border: "1px solid #303030", background: "#1c1c1c", width: 20, height: 20, borderRadius: "50%", marginLeft: i ? -16 : 0, marginTop: 2 }} />
          ))}
          <P>{wibe3.wallets.length > 0 ? formatter.truncateAddress(wibe3.wallets[0].address) : "Connect wallet"}</P>
        </div>
      </Button>
    </HeaderWrap>
  );
};

const Button = styled.button`
  border-radius: 8px;
  background: linear-gradient(0deg, #292929 0%, #292929 100%), linear-gradient(44deg, #1b1b1b 50.48%, #303030 103.9%), linear-gradient(87deg, #fff 4.14%, #c3c3c3 54.6%, #fff 100%);
  display: flex;
  padding: 0 12px;
  height: 40px;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  cursor: pointer;
  outline: none;
  border: none;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
`;

export const Tabs = styled.div`
  display: flex;
  height: 60px;
`;

export const Tab = styled.button<{ $active?: boolean }>`
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  flex: 1 0 0;
  border: none;
  background: #141518;
  border-bottom: 1px solid ${(p) => (p.$active ? "#FABA0D" : "#706c6c")};
  height: 100%;
  outline: none;
  cursor: pointer;

  p {
    color: ${(p) => (p.$active ? "#FABA0D" : "#706c6c")};
    font-weight: bolder;
  }
`;

export const HeaderWrap = styled.div`
  width: 100%;
  height: 60px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-low, rgba(255, 255, 255, 0.1));
  background: var(--surface-background-container--low, #141518);
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
`;

export default observer(Header);
