import styled from "styled-components";

const NotFound = () => {
  return (
    <Page>
      <h1>Page not found</h1>
    </Page>
  );
};

const Page = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;

  h1 {
    color: #fff;
  }
`;

export default NotFound;
