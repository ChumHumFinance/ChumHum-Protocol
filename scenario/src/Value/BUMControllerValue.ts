import {Event} from '../Event';
import {World} from '../World';
import {BUMController} from '../Contract/BUMController';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getBUMController} from '../ContractLookup';
import {encodedNumber} from '../Encoding';
import {getCTokenV} from './CTokenValue';
import { encodeParameters, encodeABI } from '../Utils';

export async function getBUMControllerAddress(world: World, bumcontroller: BUMController): Promise<AddressV> {
  return new AddressV(bumcontroller._address);
}

async function getMintableBUM(world: World, bumcontroller: BUMController, account: string): Promise<NumberV> {
  let {0: error, 1: amount} = await bumcontroller.methods.getMintableBUM(account).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to get mintable bum: error code = ${error}`);
  }
  return new NumberV(Number(amount));
}

async function getAdmin(world: World, bumcontroller: BUMController): Promise<AddressV> {
  return new AddressV(await bumcontroller.methods.admin().call());
}

async function getPendingAdmin(world: World, bumcontroller: BUMController): Promise<AddressV> {
  return new AddressV(await bumcontroller.methods.pendingAdmin().call());
}


export function bumcontrollerFetchers() {
  return [
    new Fetcher<{bumcontroller: BUMController}, AddressV>(`
        #### Address

        * "BUMController Address" - Returns address of bumcontroller
      `,
      "Address",
      [new Arg("bumcontroller", getBUMController, {implicit: true})],
      (world, {bumcontroller}) => getBUMControllerAddress(world, bumcontroller)
    ),
    new Fetcher<{bumcontroller: BUMController, account: AddressV}, NumberV>(`
        #### MintableBUM

        * "BUMController MintableBUM <User>" - Returns a given user's mintable bum amount
          * E.g. "BUMController MintableBUM Geoff"
      `,
      "MintableBUM",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {bumcontroller, account}) => getMintableBUM(world, bumcontroller, account.val)
    ),
    new Fetcher<{bumcontroller: BUMController}, AddressV>(`
        #### Admin

        * "BUMController Admin" - Returns the BUMControllers's admin
          * E.g. "BUMController Admin"
      `,
      "Admin",
      [new Arg("bumcontroller", getBUMController, {implicit: true})],
      (world, {bumcontroller}) => getAdmin(world, bumcontroller)
    ),
    new Fetcher<{bumcontroller: BUMController}, AddressV>(`
        #### PendingAdmin

        * "BUMController PendingAdmin" - Returns the pending admin of the BUMController
          * E.g. "BUMController PendingAdmin" - Returns BUMController's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
      ],
      (world, {bumcontroller}) => getPendingAdmin(world, bumcontroller)
    ),
  ];
}

export async function getBUMControllerValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BUMController", bumcontrollerFetchers(), world, event);
}
