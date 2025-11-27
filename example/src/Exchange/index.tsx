import styled from "styled-components";
import Bridge from "../wibe3/ui/payment/Bridge";
import { wibe3 } from "../engine";

const Exchange = () => {
  return (
    <Page>
      <Card>
        <Bridge widget hot={wibe3} onClose={() => {}} onProcess={() => {}} />
      </Card>
    </Page>
  );
};

const Page = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vw;
`;

const Card = styled.div`
  width: 460px;
  height: 520px;
  border: 1px solid #474747;
  background: #201f22;
  border-radius: 24px;
  padding: 24px;
`;

export default Exchange;
