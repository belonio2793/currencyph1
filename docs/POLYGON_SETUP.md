# Currency.ph Polygon Smart Contract Setup

## Overview

Currency.ph uses **ERC-1404 regulated tokens** on Polygon blockchain to track tokenized ownership of community projects. This guide covers smart contract deployment, configuration, and integration with the frontend.

---

## ERC-1404 Token Contract

### What is ERC-1404?
ERC-1404 is a regulated token standard that adds transfer restrictions. Perfect for Currency.ph because:
- **Compliance**: Transfer restrictions for KYC/AML
- **Governance**: Role-based access control
- **Transparency**: Event logs for all transfers
- **Scalability**: Low gas fees on Polygon

### Contract Features
```solidity
// src/contracts/CurrencyPHToken.sol
pragma solidity ^0.8.0;

contract CurrencyPHToken is ERC1404 {
    string public constant name = "Currency.ph Token";
    string public constant symbol = "CPH";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    // Track ownership per project
    mapping(address => mapping(uint256 => uint256)) public projectTokenBalance;
    
    // Features
    - canTransfer() // Check if transfer allowed
    - mint() // Create new tokens (admin only)
    - burn() // Destroy tokens (owner only)
    - pause() // Emergency pause (admin only)
}
```

---

## Environment Setup

### Install Hardhat (Solidity Development)
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init # Select "Typescript project" template
```

### Install Dependencies
```bash
npm install --save-dev @openzeppelin/contracts
npm install ethers@v6
```

### Create `.env` for Deployment
```bash
# Polygon Mumbai Testnet
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGON_CHAIN_ID=80001

# Polygon Mainnet (future)
POLYGON_MAINNET_RPC=https://polygon-rpc.com
POLYGON_MAINNET_CHAIN_ID=137

# Wallet for deployment
PRIVATE_KEY=your_wallet_private_key
DEPLOYER_ADDRESS=0x...your_wallet_address

# Etherscan API (for contract verification)
POLYGONSCAN_API_KEY=your_polygonscan_key
```

---

## Smart Contract Implementation

### ERC-1404 Base Contract
```solidity
// contracts/ERC1404.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

abstract contract ERC1404 is ERC20, Ownable, Pausable {
    /**
     * @notice Detects whether a transfer should be restricted and returns a
     * status code with more details when a transfer is restricted.
     * For the purposes of ERC-1404, a transfer MUST NOT proceed if it
     * would result in a status code of anything other than status code 0.
     * Status codes used by this contract are documented below along with
     * their meanings, and any third-party implementations should
     * define their own status codes for communication to calling code.
     *
     * Code 0: ALLOWED - The transfer was a success
     * Code 1: UNKNOWN_ERROR - Fundamental error with contract.
     * Code 2: CLIENT_UNKNOWN_ERROR - Error triggered in Security Officer client code
     * Code 3: SELF_TRANSFER_NOT_ALLOWED - Attempt to transfer to self.
     * Code 4: INSUFFICIENT_BALANCE - Transfer amount exceeds balance.
     * Code 5: INSUFFICIENT_ALLOWANCE - Transfer amount exceeds allowance.
     * Code 6: TRANSFER_FAILURE - Transfer to an external address would fail.
     * Code 7: TRANSFER_SUCCESSFULNESS_UNKNOWN - Outcome of transfer is unknown.
     * Code 8: MODULE_NOT_READY - Resolver contract not ready
     * Code 9: NOT_ENOUGH_TOKENS_AVAILABLE - Insufficient tokens available
     * Code 10: NON_WHITELIST_BLOCKED_TRANSFER - Transfer to non-whitelisted address
     * Code 11: TOKEN_PAUSED - Token transfers are paused
     *
     * If the `allowance()` function is not implemented, contract MUST revert on calls to `transferFrom()`
     * If the `approve()` function is not implemented, contract MUST revert on calls to `approve()`
     */
    function detectTransferRestriction (
        address from,
        address to,
        uint256 value
    )
        public
        view
        virtual
        returns (uint8)
    {
        // Implement in CurrencyPHToken
        return 0; // ALLOWED
    }

    function messageForTransferRestriction (uint8 restrictionCode)
        public
        view
        virtual
        returns (string memory)
    {
        if (restrictionCode == 0) {
            return "ALLOWED";
        }
        if (restrictionCode == 1) {
            return "UNKNOWN_ERROR";
        }
        if (restrictionCode == 2) {
            return "CLIENT_UNKNOWN_ERROR";
        }
        if (restrictionCode == 3) {
            return "SELF_TRANSFER_NOT_ALLOWED";
        }
        if (restrictionCode == 4) {
            return "INSUFFICIENT_BALANCE";
        }
        if (restrictionCode == 5) {
            return "INSUFFICIENT_ALLOWANCE";
        }
        if (restrictionCode == 6) {
            return "TRANSFER_FAILURE";
        }
        if (restrictionCode == 7) {
            return "TRANSFER_SUCCESSFULNESS_UNKNOWN";
        }
        if (restrictionCode == 8) {
            return "MODULE_NOT_READY";
        }
        if (restrictionCode == 9) {
            return "NOT_ENOUGH_TOKENS_AVAILABLE";
        }
        if (restrictionCode == 10) {
            return "NON_WHITELIST_BLOCKED_TRANSFER";
        }
        if (restrictionCode == 11) {
            return "TOKEN_PAUSED";
        }
        return "UNKNOWN_CODE";
    }
}
```

### Currency.ph Token Implementation
```solidity
// contracts/CurrencyPHToken.sol
pragma solidity ^0.8.0;

import "./ERC1404.sol";

contract CurrencyPHToken is ERC1404 {
    // Admin role for minting
    mapping(address => bool) public admins;
    
    // Whitelisted addresses (can receive transfers)
    mapping(address => bool) public whitelist;
    
    // Blacklisted addresses (cannot transfer)
    mapping(address => bool) public blacklist;
    
    // Project ownership tracking
    mapping(address => mapping(uint256 => uint256)) public projectOwnership; // user => projectId => tokenAmount
    
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event AddressWhitelisted(address indexed account);
    event AddressBlacklisted(address indexed account);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }
    
    constructor() ERC20("Currency.ph Token", "CPH") {
        admins[msg.sender] = true;
        whitelist[msg.sender] = true;
    }
    
    // Admin management
    function addAdmin(address account) external onlyOwner {
        admins[account] = true;
        emit AdminAdded(account);
    }
    
    function removeAdmin(address account) external onlyOwner {
        admins[account] = false;
        emit AdminRemoved(account);
    }
    
    // Whitelist management
    function addToWhitelist(address account) external onlyAdmin {
        whitelist[account] = true;
        emit AddressWhitelisted(account);
    }
    
    function removeFromWhitelist(address account) external onlyAdmin {
        whitelist[account] = false;
    }
    
    // Blacklist management
    function addToBlacklist(address account) external onlyAdmin {
        blacklist[account] = true;
        emit AddressBlacklisted(account);
    }
    
    function removeFromBlacklist(address account) external onlyAdmin {
        blacklist[account] = false;
    }
    
    // Mint new tokens (admin only)
    function mint(address to, uint256 amount) external onlyAdmin {
        require(to != address(0), "Invalid address");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    // Burn tokens (owner only)
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    // Pause/unpause transfers
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ERC-1404 transfer restriction
    function detectTransferRestriction(
        address from,
        address to,
        uint256 value
    ) public view override returns (uint8) {
        if (paused()) {
            return 11; // TOKEN_PAUSED
        }
        
        if (blacklist[from]) {
            return 10; // NON_WHITELIST_BLOCKED_TRANSFER
        }
        
        if (balanceOf(from) < value) {
            return 4; // INSUFFICIENT_BALANCE
        }
        
        return 0; // ALLOWED
    }
    
    // Override transfer to check restrictions
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        uint8 restrictionCode = detectTransferRestriction(from, to, amount);
        require(restrictionCode == 0, messageForTransferRestriction(restrictionCode));
        
        return super.transferFrom(from, to, amount);
    }
    
    // Track project ownership
    function recordProjectOwnership(
        address user,
        uint256 projectId,
        uint256 tokenAmount
    ) external onlyAdmin {
        projectOwnership[user][projectId] = tokenAmount;
    }
    
    // Get project ownership for user
    function getProjectOwnership(address user, uint256 projectId)
        external
        view
        returns (uint256)
    {
        return projectOwnership[user][projectId];
    }
}
```

---

## Deployment Script

### Hardhat Deployment
```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying CurrencyPHToken...");
  
  const CurrencyPHToken = await ethers.getContractFactory("CurrencyPHToken");
  const token = await CurrencyPHToken.deploy();
  
  await token.deployed();
  
  console.log(`✅ CurrencyPHToken deployed to: ${token.address}`);
  
  // Store contract address for frontend
  const fs = require("fs");
  const config = {
    contractAddress: token.address,
    network: "mumbai",
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    "deployment-config.json",
    JSON.stringify(config, null, 2)
  );
  
  console.log("📄 Deployment config saved to deployment-config.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Hardhat Configuration
```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    polygonMumbai: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001
    },
    polygonMainnet: {
      url: process.env.POLYGON_MAINNET_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137
    }
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY
  }
};

export default config;
```

---

## Deployment Steps

### 1. Compile Contract
```bash
npx hardhat compile
```

### 2. Deploy to Mumbai Testnet
```bash
npx hardhat run scripts/deploy.ts --network polygonMumbai
```

### 3. Verify on PolygonScan
```bash
npx hardhat verify --network polygonMumbai CONTRACT_ADDRESS
```

### 4. Store Contract Address
Update `.env.local`:
```bash
VITE_CPH_TOKEN_ADDRESS=0x...deployment_address
VITE_POLYGON_NETWORK=mumbai
```

---

## Frontend Integration

### Web3.js Connection
```javascript
// src/lib/web3.js
import { ethers } from "ethers";
import CurrencyPHTokenABI from "../contracts/CurrencyPHToken.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CPH_TOKEN_ADDRESS;
const POLYGON_RPC = import.meta.env.VITE_POLYGON_RPC_URL;

// Connect to Polygon RPC
const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

// Get contract instance
export const getTokenContract = () => {
  return new ethers.Contract(CONTRACT_ADDRESS, CurrencyPHTokenABI, provider);
};

// Get user's CPH balance
export const getBalance = async (userAddress) => {
  const contract = getTokenContract();
  const balance = await contract.balanceOf(userAddress);
  return ethers.formatEther(balance);
};

// Mint tokens (requires admin signer)
export const mintTokens = async (to, amount) => {
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CurrencyPHTokenABI, signer);
  
  const tx = await contract.mint(to, ethers.parseEther(amount));
  const receipt = await tx.wait();
  
  console.log(`✅ Minted ${amount} CPH to ${to}`);
  return receipt;
};

// Transfer tokens
export const transferTokens = async (to, amount) => {
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CurrencyPHTokenABI, signer);
  
  const tx = await contract.transfer(to, ethers.parseEther(amount));
  const receipt = await tx.wait();
  
  console.log(`✅ Transferred ${amount} CPH to ${to}`);
  return receipt;
};

// Check transfer restriction
export const checkTransferRestriction = async (from, to, amount) => {
  const contract = getTokenContract();
  const code = await contract.detectTransferRestriction(
    from,
    to,
    ethers.parseEther(amount)
  );
  
  if (code !== 0) {
    const message = await contract.messageForTransferRestriction(code);
    throw new Error(`Transfer restricted: ${message}`);
  }
  
  return true;
};
```

### MetaMask Connection
```javascript
// src/lib/metamask.js
export const connectWallet = async () => {
  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });
    
    return accounts[0];
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
};

export const switchToPolygon = async () => {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x13881" }] // 80001 in hex = Mumbai
    });
  } catch (error) {
    // Chain not added, add it
    if (error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x13881",
          chainName: "Polygon Mumbai",
          rpcUrls: ["https://rpc-mumbai.maticvigil.com"],
          nativeCurrency: {
            name: "MATIC",
            symbol: "MATIC",
            decimals: 18
          }
        }]
      });
    }
  }
};

export const getUserAddress = async () => {
  const accounts = await window.ethereum.request({
    method: "eth_accounts"
  });
  return accounts[0];
};
```

---

## Testing Smart Contract

### Write Tests
```typescript
// test/CurrencyPHToken.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("CurrencyPHToken", function () {
  let token: any;
  let owner: any;
  let addr1: any;

  beforeEach(async () => {
    const CurrencyPHToken = await ethers.getContractFactory("CurrencyPHToken");
    token = await CurrencyPHToken.deploy();
    
    [owner, addr1] = await ethers.getSigners();
  });

  it("Should mint tokens", async function () {
    await token.mint(addr1.address, ethers.parseEther("1000"));
    const balance = await token.balanceOf(addr1.address);
    expect(balance).to.equal(ethers.parseEther("1000"));
  });

  it("Should transfer tokens", async function () {
    await token.mint(owner.address, ethers.parseEther("1000"));
    await token.transfer(addr1.address, ethers.parseEther("100"));
    
    const balance = await token.balanceOf(addr1.address);
    expect(balance).to.equal(ethers.parseEther("100"));
  });

  it("Should prevent transfer when paused", async function () {
    await token.mint(owner.address, ethers.parseEther("1000"));
    await token.pause();
    
    await expect(
      token.transfer(addr1.address, ethers.parseEther("100"))
    ).to.be.revertedWith("TOKEN_PAUSED");
  });
});
```

### Run Tests
```bash
npx hardhat test
```

---

## Polygon Mumbai Testnet Resources

### Get MATIC (Test Funds)
1. Go to https://faucet.polygon.technology/
2. Enter your wallet address
3. Select "Mumbai" network
4. Click "Submit"
5. Wait 5-10 minutes for MATIC to arrive

### View on PolygonScan
- **Mumbai Testnet**: https://mumbai.polygonscan.com
- **Mainnet**: https://polygonscan.com

---

## Mainnet Deployment (Future)

### Before Mainnet Deployment
1. **Audit**: Have contract audited by professional firm
2. **Testing**: Extensive testing on testnet
3. **Documentation**: Clear documentation for users
4. **Governance**: Community vote on mainnet launch

### Deploy to Mainnet
```bash
npx hardhat run scripts/deploy.ts --network polygonMainnet
```

---

## Troubleshooting

### "Account is not authorized to perform this action"
- Ensure account is added as admin: `addAdmin(address)`
- Check wallet connected to MetaMask matches deployer

### "Insufficient balance"
- Get test MATIC from Mumbai faucet
- Ensure you have enough balance for gas fees

### "Contract not verified on PolygonScan"
- Run verify command after deployment
- Check constructor arguments match deployment

### "Token transfer fails with ERC-1404 error"
- Check transfer restriction: `detectTransferRestriction()`
- Ensure recipient is whitelisted if required
- Check if contract is paused

---

## Gas Cost Estimation (Mumbai Testnet)

| Operation | Gas Cost | Cost (at 2 gwei) |
|-----------|----------|------------------|
| Deploy | ~2,500,000 | ~0.005 MATIC |
| Mint | ~55,000 | ~0.00011 MATIC |
| Transfer | ~65,000 | ~0.00013 MATIC |
| Approve | ~46,000 | ~0.00009 MATIC |

*Actual costs vary based on network congestion*

---

## Security Checklist

- [ ] Contract audited by professional
- [ ] No hardcoded secrets in code
- [ ] Reentrancy guards implemented
- [ ] Access control properly set (onlyAdmin, onlyOwner)
- [ ] Transfer restrictions working
- [ ] Pause/unpause mechanism tested
- [ ] Event logs working
- [ ] Contract verified on PolygonScan

---

## Next Steps

1. [Deploy contract to Mumbai testnet](#deployment-steps)
2. [Test on testnet](#testing-smart-contract)
3. [Integrate with frontend](#frontend-integration)
4. [Community audit](#security-checklist)
5. [Deploy to mainnet (future)](#mainnet-deployment-future)

---

## Resources

- **Solidity Docs**: https://docs.soliditylang.org
- **OpenZeppelin**: https://docs.openzeppelin.com
- **Hardhat**: https://hardhat.org/docs
- **Polygon Docs**: https://polygon.technology/developers
- **ethers.js**: https://docs.ethers.org/v6/
