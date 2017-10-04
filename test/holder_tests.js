const MockContribution = artifacts.require("MockContribution");
const AIX = artifacts.require("AIX");
const APT = artifacts.require("APT");
const MiniMeTokenFactory = artifacts.require("MiniMeTokenFactory");
const Exchanger = artifacts.require("Exchanger");
const MockRemainderTokenHolder = artifacts.require("MockRemainderTokenHolder");
const assert = require("chai").assert;
const BigNumber = web3.BigNumber;
import { expectThrow, duration, latestBlock, getTime } from "./utils.js";

contract("Contribution", ([miner, owner, dev, community, remainder]) => {
  let tokenFactory;
  let aix;
  let contribution;
  let exchanger;
  let apt;
  let tokensPreSold = new BigNumber(50 * 10 ** 18);
  let multiSig = owner;
  let totalCap;
  let sendingAmount;
  let currentTime;
  let remainderHolder;
  let _devHolder;
  let _communityHolder;
  let latestBlockNumber;

  describe("#finalize", async function() {
    before(async function() {
      tokenFactory = await MiniMeTokenFactory.new();
      apt = await APT.new(tokenFactory.address);
      await apt.generateTokens(owner, tokensPreSold);
    });

    beforeEach(async function() {
      aix = await AIX.new(tokenFactory.address);
      contribution = await MockContribution.new(aix.address);
      exchanger = await Exchanger.new(
        apt.address,
        aix.address,
        contribution.address
      );

      remainderHolder = await MockRemainderTokenHolder.new(
        remainder,
        contribution.address,
        aix.address
      );

      totalCap = new BigNumber(55 * 10 ** 18); // 55 eth
      sendingAmount = new BigNumber(10 ** 18); // 1 eth
      currentTime = getTime();
      _devHolder = "0x0039F22efB07A647557C7C5d17854CFD6D489eF2";
      _communityHolder = "0x0039F22efB07A647557C7C5d17854CFD6D489eF3";

      latestBlockNumber = await latestBlock();

      await contribution.setBlockTimestamp(currentTime);
      await contribution.setBlockNumber(latestBlockNumber);

      await aix.changeController(contribution.address);

      await contribution.initialize(
        apt.address,
        exchanger.address,
        multiSig,
        remainderHolder.address,
        _devHolder,
        _communityHolder,
        totalCap,
        currentTime + 1,
        currentTime + 10
      );

      currentTime = getTime();
      latestBlockNumber = await latestBlock();
      await contribution.setBlockTimestamp(currentTime);
      await contribution.setBlockNumber(latestBlockNumber);
      await contribution.finalize();
      await contribution.allowTransfers(true);
    });

    it("Final Balances", async function() {
      const remainderHolderBalance = await aix.balanceOf(
        remainderHolder.address
      );
      const devHolderBalance = await aix.balanceOf(_devHolder);
      const communityHolderBalance = await aix.balanceOf(_communityHolder);
      const preSoldBalance = await aix.balanceOf(exchanger.address);
      const totalSupplyAfterContribution = await aix.totalSupply();
      // exchange rate = 1000
      // Unsold Wei = 5 * 10 ** 18
      assert.equal(remainderHolderBalance.toNumber(), 5 * 10 ** 18 * 1000);
      assert.equal(preSoldBalance.toNumber(), 50 * 10 ** 18 * 1250);
      assert.equal(
        devHolderBalance.toNumber(),
        (5 * 1000 + 50 * 1250) * 10 ** 18 / 51 * 20
      );
      assert.equal(
        communityHolderBalance.toNumber(),
        (5 * 1000 + 50 * 1250) * 10 ** 18 / 51 * 29
      );
      assert.equal(
        totalSupplyAfterContribution.toNumber(),
        (5 * 1000 + 50 * 1250) * 10 ** 18 / 51 * 100
      );
    });

    it("Final Values", async function() {
      let communityBalance = await aix.balanceOf(remainder);
      assert.equal(communityBalance.toNumber(), 0);

      currentTime = await getTime();
      await expectThrow(remainderHolder.collectTokens({ from: remainder }));
      communityBalance = await aix.balanceOf(remainder);
      assert.equal(communityBalance.toNumber(), 0);

      await remainderHolder.setBlockTimestamp(
        currentTime + duration.years(1) + duration.days(1)
      );
      await remainderHolder.collectTokens({ from: remainder });
      communityBalance = await aix.balanceOf(remainder);
      assert.equal(communityBalance.toNumber(), 5 * 10 ** 18 * 1000);
    });
  });
});