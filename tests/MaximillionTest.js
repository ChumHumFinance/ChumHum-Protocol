const {
  maticBalance,
  maticGasCost,
  getContract
} = require('./Utils/BSC');

const {
  makeComptroller,
  makeCToken,
  makePriceOracle,
  pretendBorrow,
  borrowSnapshot
} = require('./Utils/ChumHum');

describe('Maximillion', () => {
  let root, borrower;
  let maximillion, cMatic;
  beforeEach(async () => {
    [root, borrower] = saddle.accounts;
    cMatic = await makeCToken({kind: "cmatic", supportMarket: true});
    maximillion = await deploy('Maximillion', [cMatic._address]);
  });

  describe("constructor", () => {
    it("sets address of cMatic", async () => {
      expect(await call(maximillion, "cMatic")).toEqual(cMatic._address);
    });
  });

  describe("repayBehalf", () => {
    it("refunds the entire amount with no borrows", async () => {
      const beforeBalance = await maticBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await maticGasCost(result);
      const afterBalance = await maticBalance(root);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost));
    });

    it("repays part of a borrow", async () => {
      await pretendBorrow(cMatic, borrower, 1, 1, 150);
      const beforeBalance = await maticBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await maticGasCost(result);
      const afterBalance = await maticBalance(root);
      const afterBorrowSnap = await borrowSnapshot(cMatic, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(100));
      expect(afterBorrowSnap.principal).toEqualNumber(50);
    });

    it("repays a full borrow and refunds the rest", async () => {
      await pretendBorrow(cMatic, borrower, 1, 1, 90);
      const beforeBalance = await maticBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await maticGasCost(result);
      const afterBalance = await maticBalance(root);
      const afterBorrowSnap = await borrowSnapshot(cMatic, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.sub(gasCost).sub(90));
      expect(afterBorrowSnap.principal).toEqualNumber(0);
    });
  });
});
