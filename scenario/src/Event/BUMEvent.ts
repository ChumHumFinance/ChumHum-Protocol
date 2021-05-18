import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { BUM, BUMScenario } from '../Contract/BUM';
import { buildBUM } from '../Builder/BUMBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getBUM } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genBUM(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, bum, tokenData } = await buildBUM(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed BUM (${bum.name}) to address ${bum._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyBUM(world: World, bum: BUM, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, bum._address);
  }

  return world;
}

async function approve(world: World, from: string, bum: BUM, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bum.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved BUM token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function faucet(world: World, from: string, bum: BUM, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bum.methods.allocateTo(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Fauceted ${amount.show()} BUM tokens to ${address}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, bum: BUM, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bum.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} BUM tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, bum: BUM, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bum.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} BUM tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, bum: BUMScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bum.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} BUM tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, bum: BUMScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bum.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} BUM tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function rely(world: World, from: string, bum: BUM, address: string): Promise<World> {
  let invokation = await invoke(world, bum.methods.rely(address), from, NoErrorReporter);

  world = addAction(
    world,
    `Add rely to BUM token to ${address}`,
    invokation
  );

  return world;
}

export function bumCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new BUM token
          * E.g. "BUM Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genBUM(world, from, params.val)
    ),

    new View<{ bum: BUM, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<BUM> Verify apiKey:<String> contractName:<String>=BUM" - Verifies BUM token in BscScan
          * E.g. "BUM Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("BUM") })
      ],
      async (world, { bum, apiKey, contractName }) => {
        return await verifyBUM(world, bum, apiKey.val, bum.name, contractName.val)
      }
    ),

    new Command<{ bum: BUM, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "BUM Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "BUM Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bum, spender, amount }) => {
        return approve(world, from, bum, spender.val, amount)
      }
    ),

    new Command<{ bum: BUM, recipient: AddressV, amount: NumberV}>(`
        #### Faucet

        * "BUM Faucet recipient:<User> <Amount>" - Adds an arbitrary balance to given user
          * E.g. "BUM Faucet Geoff 1.0e18"
      `,
      "Faucet",
      [ 
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, {bum, recipient, amount}) => {
        return faucet(world, from, bum, recipient.val, amount)
      }
    ),

    new Command<{ bum: BUM, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "BUM Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "BUM Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bum, recipient, amount }) => transfer(world, from, bum, recipient.val, amount)
    ),

    new Command<{ bum: BUM, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "BUM TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "BUM TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bum, owner, spender, amount }) => transferFrom(world, from, bum, owner.val, spender.val, amount)
    ),

    new Command<{ bum: BUMScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "BUM TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "BUM TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bum, recipients, amount }) => transferScenario(world, from, bum, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ bum: BUMScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "BUM TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "BUM TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bum, froms, amount }) => transferFromScenario(world, from, bum, froms.map(_from => _from.val), amount)
    ),

    new Command<{ bum: BUM, address: AddressV, amount: NumberV }>(`
        #### Rely

        * "BUM Rely rely:<Address>" - Adds rely address
          * E.g. "BUM Rely 0xXX..."
      `,
      "Rely",
      [
        new Arg("bum", getBUM, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      (world, from, { bum, address }) => {
        return rely(world, from, bum, address.val)
      }
    ),
  ];
}

export async function processBUMEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("BUM", bumCommands(), world, event, from);
}
