import * as wagmi from 'wagmi';
import { useProvider, useSigner } from 'wagmi';
import { makeNum } from '../../lib/number-utils';
import type { BigNumber } from 'ethers';
import GoflowContract from '../../lib/contracts/Goflow.json';

export enum TokenEvent {
  Transfer = 'Transfer',
  Mint = 'Mint',
}

export type Amount = BigNumber;

const useGoflowContract = () => {
  const { data: signer } = useSigner();
  const provider = useProvider();

  const contract = wagmi.useContract({
    // Change this adress after every deploy!
    addressOrName: '0x1931BEA8e99B32c13F593d36AFB0b6cED13a185a',
    contractInterface: GoflowContract.abi,
    signerOrProvider: signer || provider,
  });

  // Get a user's balance and convert to readable number
  const getBalance = async (address: string): Promise<string> => {
    const userBalanceBN = await contract.balanceOf(address);
    return makeNum(userBalanceBN);
  };

  // "We have to approve before we can move" with transferFrom
  const approve = async (address: string, amount: BigNumber): Promise<void> => {
    const tx = await contract.approve(address, amount);
    await tx.wait();
  };

  const mint = async (amount: BigNumber): Promise<void> => {
    const tx = await contract.mint(amount);
    await tx.wait();
  };

  return {
    contract,
    chainId: contract.provider.network?.chainId,
    mint,
    approve,
    getBalance,
  };
};

export default useGoflowContract;
