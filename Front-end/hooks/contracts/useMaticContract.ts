import * as wagmi from 'wagmi';
import { useProvider, useSigner } from 'wagmi';
import { makeNum } from '../../lib/number-utils';
import type { BigNumber } from 'ethers';
import MaticContract from '../../../Hardhat/artifacts/contracts/Matic.sol/Matic.json';

export type Amount = BigNumber;

const useMaticContract = () => {
  const { data: signer } = useSigner();
  const provider = useProvider();

  const contract = wagmi.useContract({
    // Change this adress after every deploy!
    addressOrName: '<YOUR-CONTRACT-ADDRESS>',
    contractInterface: MaticContract.abi,
    signerOrProvider: signer || provider,
  });

  const getBalance = async (address: string): Promise<string> => {
    const userBalanceBN = await contract.balanceOf(address);
    return makeNum(userBalanceBN);
  };

  const approve = async (address: string, amount: BigNumber): Promise<void> => {
    const tx = await contract.approve(address, amount);
    await tx.wait();
  };

  return {
    contract,
    chainId: contract.provider.network?.chainId,
    approve,
    getBalance,
  };
};

export default useMaticContract;