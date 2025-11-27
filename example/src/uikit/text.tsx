import styled from "styled-components";

export const P = styled.p`
  color: var(--text-primary, #ebdedc);
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 140%; /* 22.4px */
  letter-spacing: -0.48px;
  margin: 0;
`;

export const PSmall = styled.p`
  color: var(--text-tertiary, #706c6c);
  font-feature-settings: "calt" off;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: 14px;
  margin: 0;
`;

export const H3 = styled.h3`
  color: var(--text-text-primary, #fff);
  font-feature-settings: "liga" off;
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
  line-height: normal;
  margin: 0;
`;
