import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, BigNumber } from 'ethers';
import { makeBig, makeNum } from '../../Front-end/lib/number-utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

function logBalances(myHoldings: any) { 
  for (const [key, value] of Object.entries(myHoldings)) {
    if (key.length > 1) {
      console.log('  ', `${key}: ${makeNum(value as BigNumber)}`);
    }
  }
}

describe('Amm', () => {
  let amm: Contract;
  let matic: Contract;
  let goflow: Contract;
  let owner: SignerWithAddress, user1: SignerWithAddress

  // Quickly approves the AMM contract and provides it with liquidity for a given user
  const provideLiquidity = async (user: SignerWithAddress, allowAmount = 1_000, provideAmount = 100) => {
    const allow = makeBig(allowAmount); //1_000
    const provide = makeBig(provideAmount); //100
    const approve = await goflow.connect(user).approve(amm.address, allow);
    await approve.wait();
    const approve2 = await matic.connect(user).approve(amm.address, allow);
    await approve2.wait();
    const liquidity = await amm.connect(user).provide(provide, provide);
    await liquidity.wait();
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
    const mint = await goflow.mint(makeBig(1000));
    await mint.wait();
    const mint2 = await goflow.connect(user1).mint(makeBig(1000));
    await mint2.wait();
    const transfer = await matic.transfer(user1.address, makeBig(1000));
    await transfer.wait();
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

    it('should revert with Amount cannot be zero', async () => {
      await provideLiquidity(owner);
      const swap = amm.swapGoflow(makeBig(0))
      await expect(swap).to.be.revertedWith('Amount cannot be zero!');
    });
  });

  describe('Withdraw', () => {
    it('should be possible to withdraw shares', async () => {
      let myHoldings = await amm.getMyHoldings(owner.address);
      console.log('INITIAL:');
      logBalances(myHoldings);

      await provideLiquidity(owner);
      
      myHoldings = await amm.getMyHoldings(owner.address);
      console.log('BEFORE WITHDRAWAL: ');
      logBalances(myHoldings);
      expect(myHoldings.myShare).to.equal(makeBig(100));

      await amm.swapMatic(makeBig(50));
      await amm.withdraw(myHoldings.myShare);

      myHoldings = await amm.getMyHoldings(owner.address);
      console.log('AFTER WITHDRAWAL');
      logBalances(myHoldings);

      expect(await myHoldings.myShare).to.equal(0);
      expect(await matic.balanceOf(owner.address)).to.equal(makeBig(1000));
      expect(await goflow.balanceOf(owner.address)).to.equal(makeBig(1000));
    });

    it('should be possible for two users to withdraw shares', async () => {
      await provideLiquidity(owner);
      await provideLiquidity(user1);

      const ownersShare = await amm.connect(owner).getMyHoldings(owner.address);
      const user1Share = await amm.connect(user1).getMyHoldings(user1.address);
      let poolDetails = await amm.getPoolDetails();
      console.log('owner share:', ownersShare.myShare);
      console.log('user1 share:', user1Share.myShare);
      console.log('poolDetails:');
      logBalances(poolDetails);

      expect(poolDetails.ammShares).to.equal(makeBig(200));

      await amm.withdraw(ownersShare.myShare);
      await amm.connect(user1).withdraw(user1Share.myShare);
      poolDetails = await amm.getPoolDetails();

      expect(poolDetails.ammShares).to.equal(0);
    });
  });
})