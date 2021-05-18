import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {BUMController} from '../Contract/BUMController';
import {BUMControllerImpl} from '../Contract/BUMControllerImpl';
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
import {buildBUMControllerImpl} from '../Builder/BUMControllerImplBuilder';
import {BUMControllerErrorReporter} from '../ErrorReporter';
import {getBUMController, getBUMControllerImpl} from '../ContractLookup';
// import {getLiquidity} from '../Value/BUMControllerValue';
import {getCTokenV} from '../Value/CTokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genBUMController(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, bumcontrollerImpl: bumcontroller, bumcontrollerImplData: bumcontrollerData} = await buildBUMControllerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added BUMController (${bumcontrollerData.description}) at address ${bumcontroller._address}`,
    bumcontrollerData.invokation
  );

  return world;
};

async function setPendingAdmin(world: World, from: string, bumcontroller: BUMController, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, bumcontroller.methods._setPendingAdmin(newPendingAdmin), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `BUMController: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, bumcontroller: BUMController): Promise<World> {
  let invokation = await invoke(world, bumcontroller.methods._acceptAdmin(), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `BUMController: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, bumcontroller: BUMController, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: bumcontroller._address,
      data: fnData,
      from: from
    })
  return world;
}

async function setComptroller(world: World, from: string, bumcontroller: BUMController, comptroller: string): Promise<World> {
  let invokation = await invoke(world, bumcontroller.methods._setComptroller(comptroller), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `Set Comptroller to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, bumcontroller: BUMController, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bumcontroller.methods.mintBUM(amount.encode()), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `BUMController: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repay(world: World, from: string, bumcontroller: BUMController, amount: NumberV): Promise<World> {
  let invokation;
  let showAmount;

  showAmount = amount.show();
  invokation = await invoke(world, bumcontroller.methods.repayBUM(amount.encode()), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `BUMController: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}


async function liquidateBUM(world: World, from: string, bumcontroller: BUMController, borrower: string, collateral: CToken, repayAmount: NumberV): Promise<World> {
  let invokation;
  let showAmount;

  showAmount = repayAmount.show();
  invokation = await invoke(world, bumcontroller.methods.liquidateBUM(borrower, repayAmount.encode(), collateral._address), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `BUMController: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function setTreasuryData(
  world: World,
  from: string,
  bumcontroller: BUMController,
  guardian: string,
  address: string,
  percent: NumberV,
): Promise<World> {
  let invokation = await invoke(world, bumcontroller.methods._setTreasuryData(guardian, address, percent.encode()), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `Set treasury data to guardian: ${guardian}, address: ${address}, percent: ${percent.show()}`,
    invokation
  );

  return world;
}

async function initialize(
  world: World,
  from: string,
  bumcontroller: BUMController
): Promise<World> {
  let invokation = await invoke(world, bumcontroller.methods.initialize(), from, BUMControllerErrorReporter);

  world = addAction(
    world,
    `Initizlied the BUMController`,
    invokation
  );

  return world;
}

export function bumcontrollerCommands() {
  return [
    new Command<{bumcontrollerParams: EventV}>(`
        #### Deploy

        * "BUMController Deploy ...bumcontrollerParams" - Generates a new BUMController (not as Impl)
          * E.g. "BUMController Deploy YesNo"
      `,
      "Deploy",
      [new Arg("bumcontrollerParams", getEventV, {variadic: true})],
      (world, from, {bumcontrollerParams}) => genBUMController(world, from, bumcontrollerParams.val)
    ),

    new Command<{bumcontroller: BUMController, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * BUMController Send functionSignature:<String> callArgs[] - Sends any transaction to bumcontroller
      * E.g: BUMController Send "setBUMAddress(address)" (Address BUM)
      `,
      "Send",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {bumcontroller, signature, callArgs}) => sendAny(world, from, bumcontroller, signature.val, rawValues(callArgs))
    ),

    new Command<{ bumcontroller: BUMController, comptroller: AddressV}>(`
        #### SetComptroller

        * "BUMController SetComptroller comptroller:<Address>" - Sets the comptroller address
          * E.g. "BUMController SetComptroller 0x..."
      `,
      "SetComptroller",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, {bumcontroller, comptroller}) => setComptroller(world, from, bumcontroller, comptroller.val)
    ),

    new Command<{ bumcontroller: BUMController, amount: NumberV }>(`
        #### Mint

        * "BUMController Mint amount:<Number>" - Mint the given amount of BUM as specified user
          * E.g. "BUMController Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { bumcontroller, amount }) => mint(world, from, bumcontroller, amount),
    ),

    new Command<{ bumcontroller: BUMController, amount: NumberV }>(`
        #### Repay

        * "BUMController Repay amount:<Number>" - Repays BUM in the given amount as specified user
          * E.g. "BUMController Repay 1.0e18"
      `,
      "Repay",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { bumcontroller, amount }) => repay(world, from, bumcontroller, amount),
    ),

    new Command<{ bumcontroller: BUMController, borrower: AddressV, CToken: CToken, collateral: CToken, repayAmount: NumberV }>(`
        #### LiquidateBUM

        * "BUMController LiquidateBUM borrower:<User> CTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of BUM seizing collateral token
          * E.g. "BUMController LiquidateBUM Geoff cBAT 1.0e18"
      `,
      "LiquidateBUM",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getCTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { bumcontroller, borrower, collateral, repayAmount }) => liquidateBUM(world, from, bumcontroller, borrower.val, collateral, repayAmount),
    ),

    new Command<{bumcontroller: BUMController, guardian: AddressV, address: AddressV, percent: NumberV}>(`
      #### SetTreasuryData
      * "BUMController SetTreasuryData <guardian> <address> <rate>" - Sets Treasury Data
      * E.g. "BUMController SetTreasuryData 0x.. 0x.. 1e18
      `,
      "SetTreasuryData",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true}),
        new Arg("guardian", getAddressV),
        new Arg("address", getAddressV),
        new Arg("percent", getNumberV)
      ],
      (world, from, {bumcontroller, guardian, address, percent}) => setTreasuryData(world, from, bumcontroller, guardian.val, address.val, percent)
    ),

    new Command<{bumcontroller: BUMController}>(`
      #### Initialize
      * "BUMController Initialize" - Call Initialize
      * E.g. "BUMController Initialize
      `,
      "Initialize",
      [
        new Arg("bumcontroller", getBUMController, {implicit: true})
      ],
      (world, from, {bumcontroller}) => initialize(world, from, bumcontroller)
    )
  ];
}

export async function processBUMControllerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("BUMController", bumcontrollerCommands(), world, event, from);
}
