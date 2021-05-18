const BigNumber = require('bignumber.js');

const {
  address,
  maticMantissa
} = require('./Utils/BSC');

const {
  makeCToken,
  makePriceOracle,
} = require('./Utils/ChumHum');

describe('PriceOracleProxy', () => {
  let root, accounts;
  let oracle, backingOracle, cMatic, cUsdc, cSai, cDai, cUsdt, cOther;
  let daiOracleKey = address(2);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    cMatic = await makeCToken({kind: "cmatic", comptrollerOpts: {kind: "v1-no-proxy"}, supportMarket: true});
    cUsdc = await makeCToken({comptroller: cMatic.comptroller, supportMarket: true});
    cSai = await makeCToken({comptroller: cMatic.comptroller, supportMarket: true});
    cDai = await makeCToken({comptroller: cMatic.comptroller, supportMarket: true});
    cUsdt = await makeCToken({comptroller: cMatic.comptroller, supportMarket: true});
    cOther = await makeCToken({comptroller: cMatic.comptroller, supportMarket: true});

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxy',
      [
        root,
        backingOracle._address,
        cMatic._address,
        cUsdc._address,
        cSai._address,
        cDai._address,
        cUsdt._address
      ]
     );
  });

  describe("constructor", () => {
    it("sets address of guardian", async () => {
      let configuredGuardian = await call(oracle, "guardian");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of v1 oracle", async () => {
      let configuredOracle = await call(oracle, "v1PriceOracle");
      expect(configuredOracle).toEqual(backingOracle._address);
    });

    it("sets address of cMatic", async () => {
      let configuredCMATIC = await call(oracle, "cMaticAddress");
      expect(configuredCMATIC).toEqual(cMatic._address);
    });

    it("sets address of cUSDC", async () => {
      let configuredCUSD = await call(oracle, "cUsdcAddress");
      expect(configuredCUSD).toEqual(cUsdc._address);
    });

    it("sets address of cSAI", async () => {
      let configuredCSAI = await call(oracle, "cSaiAddress");
      expect(configuredCSAI).toEqual(cSai._address);
    });

    it("sets address of cDAI", async () => {
      let configuredCDai = await call(oracle, "cDaiAddress");
      expect(configuredCDai).toEqual(cDai._address);
    });

    it("sets address of cUSDT", async () => {
      let configuredCUSDT = await call(oracle, "cUsdtAddress");
      expect(configuredCUSDT).toEqual(cUsdt._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setAndVerifyBackingPrice = async (cToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [cToken._address, maticMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [cToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);;
    };

    it("always returns 1e18 for cMatic", async () => {
      await readAndVerifyProxyPrice(cMatic, 1);
    });

    it("uses address(1) for USDC and address(2) for CDai", async () => {
      await send(backingOracle, "setDirectPrice", [address(1), maticMantissa(5e12)]);
      await send(backingOracle, "setDirectPrice", [address(2), maticMantissa(8)]);
      await readAndVerifyProxyPrice(cDai, 8);
      await readAndVerifyProxyPrice(cUsdc, 5e12);
      await readAndVerifyProxyPrice(cUsdt, 5e12);
    });

    it("proxies for whitelisted tokens", async () => {
      await setAndVerifyBackingPrice(cOther, 11);
      await readAndVerifyProxyPrice(cOther, 11);

      await setAndVerifyBackingPrice(cOther, 37);
      await readAndVerifyProxyPrice(cOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makeCToken({comptroller: cMatic.comptroller});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });

    it("correctly handle setting SAI price", async () => {
      await send(backingOracle, "setDirectPrice", [daiOracleKey, maticMantissa(0.01)]);

      await readAndVerifyProxyPrice(cDai, 0.01);
      await readAndVerifyProxyPrice(cSai, 0.01);

      await send(oracle, "setSaiPrice", [maticMantissa(0.05)]);

      await readAndVerifyProxyPrice(cDai, 0.01);
      await readAndVerifyProxyPrice(cSai, 0.05);

      await expect(send(oracle, "setSaiPrice", [1])).rejects.toRevert("revert SAI price may only be set once");
    });

    it("only guardian may set the sai price", async () => {
      await expect(send(oracle, "setSaiPrice", [1], {from: accounts[0]})).rejects.toRevert("revert only guardian may set the SAI price");
    });

    it("sai price must be bounded", async () => {
      await expect(send(oracle, "setSaiPrice", [maticMantissa(10)])).rejects.toRevert("revert SAI price must be < 0.1 MATIC");
    });
});
});
