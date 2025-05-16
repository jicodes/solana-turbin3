/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/arbcheck.json`.
 */
export type Arbcheck = {
  address: "7xNxrvV9454Eo9whXXkXdKEVoMsw2V9sEiQPkpNiYAxx";
  metadata: {
    name: "arbcheck";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "checkProfit";
      discriminator: [241, 84, 51, 141, 62, 134, 212, 170];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "wsolAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "user";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "wsolMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "wsolMint";
          address: "So11111111111111111111111111111111111111112";
        },
        {
          name: "state";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 116, 97, 116, 101];
              },
              {
                kind: "account";
                path: "user";
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "minProfit";
          type: "u64";
        },
      ];
    },
    {
      name: "saveBalance";
      discriminator: [243, 48, 22, 230, 18, 94, 167, 164];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "wsolAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "user";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "wsolMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "wsolMint";
          address: "So11111111111111111111111111111111111111112";
        },
        {
          name: "state";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 116, 97, 116, 101];
              },
              {
                kind: "account";
                path: "user";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "arbState";
      discriminator: [53, 37, 110, 101, 185, 164, 241, 220];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "notProfitable";
      msg: "Profit is not enough after tip";
    },
    {
      code: 6001;
      name: "underflow";
      msg: "Underflow in calculation";
    },
  ];
  types: [
    {
      name: "arbState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "initialBalance";
            type: "u64";
          },
        ];
      };
    },
  ];
  constants: [
    {
      name: "seed";
      type: "string";
      value: '"anchor"';
    },
  ];
};
