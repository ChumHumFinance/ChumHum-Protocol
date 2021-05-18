import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { CHUM, CHUMScenario } from '../Contract/CHUM';
import { buildCHUM } from '../Builder/CHUMBuilder';
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
import { getCHUM } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genCHUM(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, chum, tokenData } = await buildCHUM(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed CHUM (${chum.name}) to address ${chum._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyCHUM(world: World, chum: CHUM, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, chum._address);
  }

  return world;
}

async function approve(world: World, from: string, chum: CHUM, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, chum.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved CHUM token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, chum: CHUM, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, chum.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} CHUM tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, chum: CHUM, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, chum.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} CHUM tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, chum: CHUMScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, chum.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} CHUM tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, chum: CHUMScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, chum.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} CHUM tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, chum: CHUM, account: string): Promise<World> {
  let invokation = await invoke(world, chum.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  chum: CHUM,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set CHUM blockNumber to ${blockNumber.show()}`,
    await invoke(world, chum.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function chumCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new CHUM token
          * E.g. "CHUM Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genCHUM(world, from, params.val)
    ),

    new View<{ chum: CHUM, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<CHUM> Verify apiKey:<String> contractName:<String>=CHUM" - Verifies CHUM token in BscScan
          * E.g. "CHUM Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("CHUM") })
      ],
      async (world, { chum, apiKey, contractName }) => {
        return await verifyCHUM(world, chum, apiKey.val, chum.name, contractName.val)
      }
    ),

    new Command<{ chum: CHUM, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "CHUM Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "CHUM Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { chum, spender, amount }) => {
        return approve(world, from, chum, spender.val, amount)
      }
    ),

    new Command<{ chum: CHUM, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "CHUM Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "CHUM Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { chum, recipient, amount }) => transfer(world, from, chum, recipient.val, amount)
    ),

    new Command<{ chum: CHUM, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "CHUM TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "CHUM TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { chum, owner, spender, amount }) => transferFrom(world, from, chum, owner.val, spender.val, amount)
    ),

    new Command<{ chum: CHUMScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "CHUM TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "CHUM TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { chum, recipients, amount }) => transferScenario(world, from, chum, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ chum: CHUMScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "CHUM TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "CHUM TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { chum, froms, amount }) => transferFromScenario(world, from, chum, froms.map(_from => _from.val), amount)
    ),

    new Command<{ chum: CHUM, account: AddressV }>(`
        #### Delegate

        * "CHUM Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "CHUM Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("chum", getCHUM, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { chum, account }) => delegate(world, from, chum, account.val)
    ),
    new Command<{ chum: CHUM, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the CHUM Harness
      * E.g. "CHUM SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('chum', getCHUM, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { chum, blockNumber }) => setBlockNumber(world, from, chum, blockNumber)
      )
  ];
}

export async function processCHUMEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("CHUM", chumCommands(), world, event, from);
}
