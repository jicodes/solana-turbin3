import wallet from "../dev-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createGenericFile, createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"
import { readFile } from "fs/promises"
import { join } from "path"

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader());
umi.use(signerIdentity(signer));

const IMAGE_PATH = join(__dirname, "rug_day.jpeg");

(async () => {
    try {
        // 1. Load image
        const imageBuffer = await readFile(IMAGE_PATH);
        
        // 2. Convert image to generic file
        const imageFile = createGenericFile(
            imageBuffer,
            "rug_day.jpeg",
            {
                contentType: "image/jpeg"
            }
        );

        // 3. Upload image
        const [myUri] = await umi.uploader.upload([imageFile]);
        console.log("Your image URI: ", myUri);
    }
    catch(error) {
        console.log("Oops.. Something went wrong", error);
    }
})();