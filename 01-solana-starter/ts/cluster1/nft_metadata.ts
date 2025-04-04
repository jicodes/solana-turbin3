import wallet from "../dev-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createGenericFile, createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader());
umi.use(signerIdentity(signer));

(async () => {
    try {
        // Follow this JSON structure
        // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure

        // NFT metadata
        const imageUri = "https://devnet.irys.xyz/DZESpEdnAino4zZfGzaxUkdVkKZPmNzvT9Uo9ZeREzB8";
        const metadata = {
            name: "Rug Day NFT",
            symbol: "RUG",
            description: "A special NFT celebrating Rug Day",
            image: imageUri,
            attributes: [
                {trait_type: 'Cohort', value: 'Rug day'}
            ],
            properties: {
                files: [
                    {
                        type: "image/jpeg",
                        uri: imageUri
                    },
                ]
            },
            creators: []
        };
        // Convert metadata to JSON and upload
        const metadataBuffer = Buffer.from(JSON.stringify(metadata));
        const metadataFile = createGenericFile(metadataBuffer, "metadata.json", { contentType: "application/json" });
        const [metadataUri] = await umi.uploader.upload([metadataFile]);
        console.log("Your metadata URI: ", metadataUri);
    }
    catch(error) {
        console.log("Oops.. Something went wrong", error);
    }
})();
