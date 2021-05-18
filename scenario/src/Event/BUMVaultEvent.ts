import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {BUMVault} from '../Contract/BUMVault';
import {BUMVaultImpl} from '../Contract/BUMVaultImpl';
import {CToken} from '../Contract/CToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildBUMVaultImpl} from '../Builder/BUMVaultImplBuilder';
import {BUMVaultErrorReporter} from '../ErrorReporter';
import {getBUMVault, getBUMVaultImpl} from '../ContractLookup';
// import {getLiquidity} from '../Value/BUMVaultValue';
import {getCTokenV} from '../Value/CTokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genBUMVault(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, bumvaultImpl: bumvault, bumvaultImplData: bumvaultData} = await buildBUMVaultImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added BUMVault (${bumvaultData.description}) at address ${bumvault._address}`,
    bumvaultData.invokation
  );

  return world;
};

async function setPendingAdmin(world: World, from: string, bumvault: BUMVault, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, bumvault.methods._setPendingAdmin(newPendingAdmin), from, BUMVaultErrorReporter);

  world = addAction(
    world,
    `BUMVault: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, bumvault: BUMVault): Promise<World> {
  let invokation = await invoke(world, bumvault.methods._acceptAdmin(), from, BUMVaultErrorReporter);

  world = addAction(
    world,
    `BUMVault: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, bumvault: BUMVault, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: bumvault._address,
      data: fnData,
      from: from
    })
  return world;
}



export function bumvaultCommands() {
  return [
    new Command<{bumvaultParams: EventV}>(`
        #### Deploy

        * "BUMVault Deploy ...bumvaultParams" - Generates a new BUMVault (not as Impl)
          * E.g. "BUMVault Deploy YesNo"
      `,
      "Deploy",
      [new Arg("bumvaultParams", getEventV, {variadic: true})],
      (world, from, {bumvaultParams}) => genBUMVault(world, from, bumvaultParams.val)
    ),

    new Command<{bumvault: BUMVault, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * BUMVault Send functionSignature:<String> callArgs[] - Sends any transaction to bumvault
      * E.g: BUMVault Send "setBUMAddress(address)" (Address BUM)
      `,
      "Send",
      [
        new Arg("bumvault", getBUMVault, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {bumvault, signature, callArgs}) => sendAny(world, from, bumvault, signature.val, rawValues(callArgs))
    ),

  ];
}

export async function processBUMVaultEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("BUMVault", bumvaultCommands(), world, event, from);
}
