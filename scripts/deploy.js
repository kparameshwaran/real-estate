const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether');
};

async function main() {
  console.log("\n==========================================");
  console.log("   🏠 MILLOW REAL ESTATE DEPLOYMENT");
  console.log("==========================================\n");

  // Setup accounts
  const [buyer, seller, inspector, lender] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  console.log(`📍 Network: ${network.name} (ChainID: ${chainId})`);
  console.log(`👤 Roles Assigned:`);
  console.log(`   - Buyer:     ${buyer.address}`);
  console.log(`   - Seller:    ${seller.address}`);
  console.log(`   - Inspector: ${inspector.address}`);
  console.log(`   - Lender:    ${lender.address}\n`);

  // Deploy Real Estate NFT Contract
  console.log("🚀 Deploying Real Estate Contract...");
  const RealEstate = await ethers.getContractFactory('RealEstate');
  const realEstate = await RealEstate.connect(seller).deploy();
  await realEstate.deployed();
  console.log(`   ✔ Real Estate Contract deployed at: ${realEstate.address}`);

  // Deploy Escrow Contract
  console.log("\n🚀 Deploying Escrow Contract...");
  const Escrow = await ethers.getContractFactory('Escrow');
  const escrow = await Escrow.connect(seller).deploy(
    realEstate.address,
    seller.address,
    inspector.address,
    lender.address
  );
  await escrow.deployed();
  console.log(`   ✔ Escrow Contract deployed at: ${escrow.address}`);

  // Mint Properties
  const propertyCount = 4;
  console.log(`\n🎨 Minting ${propertyCount} luxury properties as NFTs...`);

  for (let i = 1; i <= propertyCount; i++) {
    const tokenURI = `/metadata/${i}.json`;
    const tx = await realEstate.connect(seller).mint(tokenURI);
    await tx.wait();
    console.log(`   ✔ Minted Token #${i} with URI: ${tokenURI}`);
  }

  // Approve Properties for Escrow
  console.log("\n🔑 Approving properties for Escrow contract transfer...");
  for (let i = 1; i <= propertyCount; i++) {
    const tx = await realEstate.connect(seller).approve(escrow.address, i);
    await tx.wait();
    console.log(`   ✔ Token #${i} approved for Escrow`);
  }

  // List Properties in Escrow
  console.log("\n📋 Listing properties on Escrow marketplace...");
  const listings = [
    { id: 1, price: tokens(20), escrow: tokens(10), name: "Luxury NYC Penthouse" },
    { id: 2, price: tokens(15), escrow: tokens(5),  name: "Architectural CA Modern Home" },
    { id: 3, price: tokens(10), escrow: tokens(5),  name: "WA Nature Coastal Estate" },
    { id: 4, price: tokens(25), escrow: tokens(10), name: "Biscayne Bay Ultra Villa" }
  ];

  for (const item of listings) {
    const tx = await escrow.connect(seller).list(item.id, buyer.address, item.price, item.escrow);
    await tx.wait();
    console.log(`   ✔ Listed #${item.id} (${item.name}) - Price: ${ethers.utils.formatEther(item.price)} ETH | Escrow: ${ethers.utils.formatEther(item.escrow)} ETH`);
  }

  // Update src/config.json automatically
  const configPath = path.join(__dirname, '..', 'src', 'config.json');
  let currentConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      currentConfig = {};
    }
  }

  currentConfig[chainId] = {
    realEstate: {
      address: realEstate.address
    },
    escrow: {
      address: escrow.address
    },
    roles: {
      buyer: buyer.address,
      seller: seller.address,
      inspector: inspector.address,
      lender: lender.address
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 4));
  console.log(`\n💾 Saved updated configuration to src/config.json for ChainID ${chainId}`);

  // Ensure ABIs are synced
  const abiDir = path.join(__dirname, '..', 'src', 'abis');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const realEstateArtifact = await hre.artifacts.readArtifact("RealEstate");
  const escrowArtifact = await hre.artifacts.readArtifact("Escrow");

  fs.writeFileSync(path.join(abiDir, 'RealEstate.json'), JSON.stringify(realEstateArtifact, null, 2));
  fs.writeFileSync(path.join(abiDir, 'Escrow.json'), JSON.stringify(escrowArtifact, null, 2));
  console.log(`📄 Synced Contract ABIs to src/abis/`);

  console.log("\n==========================================");
  console.log("   🎉 DEPLOYMENT COMPLETE & READY!");
  console.log("==========================================\n");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
