import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, BigNumber } from 'ethers';
import { makeBig, makeNum } from '../../Front-end/lib/number-utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Amm', () => {
  let amm: Contract;
  let matic: Contract;
  let goflow: Contract;
  let owner: SignerWithAddress, user1: SignerWithAddress

  // Quickly approves the AMM contract and provides it with liquidity for a given user
	const provideLiquidity = async (user: SignerWithAddress, allowAmount = 1_000, provideAmount = 100) => {
    const allow = makeBig(allowAmount); //1_000
    const provide = makeBig(provideAmount); //100
    await goflow.connect(user).approve(amm.address, allow);
    await matic.connect(user).approve(amm.address, allow);
    await amm.connect(user).provide(provide, provide);
  };

  beforeEach(async () => {
    // the getSigners() method allows us a to create mock users
    const [_owner, _user1] = await ethers.getSigners();
    owner = _owner;
    user1 = _user1;
  });

  beforeEach(async () => {
    // Deploy the Matic contract
    const Matic = await ethers.getContractFactory('Matic');
    matic = await Matic.deploy();
    await matic.deployed();
    // Deploy the Goflow contract
    const Goflow = await ethers.getContractFactory('Goflow');
    goflow = await Goflow.deploy();
    await goflow.deployed();
    // Deploy the AMM contract
    const Amm = await ethers.getContractFactory('AMM');
    amm = await Amm.deploy(matic.address, goflow.address);
    await amm.deployed();

    // Mint and transfer tokens so that owner and user1 have 1000 of each
    await goflow.mint(makeBig(1000));
    await goflow.connect(user1).mint(makeBig(1000));
    await matic.transfer(user1.address, makeBig(1000));
  });

  describe('Deployment', () => {
    it('should deploy the contracts', async () => {
      expect(await matic.totalSupply()).to.equal(makeBig(2000));
      expect(await goflow.totalSupply()).to.equal(makeBig(2000));
      expect(await amm.address).to.exist;
    });
  });

  describe('Provide liquidity', () => {
    it('should allow a user to provide liquidity', async () => {
      await provideLiquidity(owner);
      const [totalmatic, totalGoverflow, totalShares] = await amm.getPoolDetails();
      expect(totalmatic).to.equal(makeBig(100));
      expect(totalGoverflow).to.equal(makeBig(100));
      expect(totalShares).to.equal(makeBig(100));
    });
  });

  describe('Swaps', () => {
    it('should be possible to swap matic for goflow', async () => {
      await provideLiquidity(owner);
      await matic.approve(amm.address, makeBig(100)); // approve before we can move with transferFrom

      const tx = await amm.swapMatic(makeBig(100));
      await tx.wait();

      expect(tx.hash).to.exist;
      expect(await matic.balanceOf(amm.address)).to.equal(makeBig(200));
      expect(await goflow.balanceOf(amm.address)).to.equal(makeBig(50));
    });

    it('should be possible to swap goflow for matic', async () => {
      await provideLiquidity(owner);
      await goflow.approve(amm.address, makeBig(100)); // approve before we can move with transferFrom

      const tx = await amm.swapGoflow(makeBig(100));
      await tx.wait();

      expect(tx.hash).to.exist;
      expect(await matic.balanceOf(amm.address)).to.equal(makeBig(50));
      expect(await goflow.balanceOf(amm.address)).to.equal(makeBig(200));
    });
  });
})