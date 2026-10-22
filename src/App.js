import { useEffect, useState, useMemo } from 'react';
import { ethers } from 'ethers';

// Components
import Navigation from './components/Navigation';
import Search from './components/Search';
import Home from './components/Home';
import RoleSwitcher from './components/RoleSwitcher';
import ListPropertyModal from './components/ListPropertyModal';

// ABIs
import RealEstateABI from './abis/RealEstate.json';
import EscrowABI from './abis/Escrow.json';

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null);
  const [realEstate, setRealEstate] = useState(null);
  const [escrow, setEscrow] = useState(null);

  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [networkName, setNetworkName] = useState('');

  const [homes, setHomes] = useState([]);
  const [selectedHome, setSelectedHome] = useState(null);
  const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [maxPrice, setMaxPrice] = useState(50);
  const [sortBy, setSortBy] = useState('featured');

  // Network Switch Handler
  const switchNetworkToLocalhost = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }] // 31337 in hex
        });
      } catch (switchError) {
        // If localhost chain is not added to metamask, request to add it
        if (switchError.code === 4902 || switchError.code === -32603) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x7a69',
                  chainName: 'Hardhat Localhost',
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['http://127.0.0.1:8545']
                }
              ]
            });
          } catch (addError) {
            console.error("Failed to add localhost chain:", addError);
          }
        } else {
          console.error("Failed to switch network:", switchError);
        }
      }
    }
  };

  const loadBlockchainData = async () => {
    setIsLoading(true);
    setErrorBanner(null);

    let activeProvider;
    let userAccount = null;

    try {
      if (typeof window.ethereum !== 'undefined') {
        activeProvider = new ethers.providers.Web3Provider(window.ethereum);
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            userAccount = ethers.utils.getAddress(accounts[0]);
            setAccount(userAccount);
            const bal = await activeProvider.getBalance(userAccount);
            setBalance(parseFloat(ethers.utils.formatEther(bal)).toFixed(3));
          }
        } catch (e) {
          console.warn("Could not retrieve accounts automatically:", e);
        }
      } else {
        // Fallback to local JsonRpcProvider for seamless read-only exploration
        activeProvider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
      }

      setProvider(activeProvider);

      let currentNetwork;
      try {
        currentNetwork = await activeProvider.getNetwork();
      } catch (netErr) {
        // Fallback to 31337
        currentNetwork = { chainId: 31337, name: 'localhost' };
      }

      setChainId(currentNetwork.chainId);
      setNetworkName(currentNetwork.name);

      // Determine contract addresses
      const networkConfig = config[currentNetwork.chainId] || config['31337'];
      if (!networkConfig || !networkConfig.realEstate || !networkConfig.escrow) {
        setErrorBanner(`No deployed contracts found for Network ID ${currentNetwork.chainId}. Please deploy contracts using "npx hardhat run ./scripts/deploy.js --network localhost".`);
        setIsLoading(false);
        return;
      }

      const realEstateContract = new ethers.Contract(networkConfig.realEstate.address, RealEstateABI.abi || RealEstateABI, activeProvider);
      const escrowContract = new ethers.Contract(networkConfig.escrow.address, EscrowABI.abi || EscrowABI, activeProvider);

      setRealEstate(realEstateContract);
      setEscrow(escrowContract);

      // Query total minted supply
      let totalSupply = 0;
      try {
        const supplyBN = await realEstateContract.totalSupply();
        totalSupply = supplyBN.toNumber();
      } catch (err) {
        console.warn("Could not query totalSupply, defaulting to 4 properties:", err);
        totalSupply = 4;
      }

      const loadedHomes = [];

      for (let i = 1; i <= totalSupply; i++) {
        let metadata = null;

        // Try tokenURI first
        try {
          const uri = await realEstateContract.tokenURI(i);
          if (uri.startsWith('http')) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(uri, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
              const text = await res.text();
              try {
                metadata = JSON.parse(text);
              } catch (e) {}
            }
          } else if (uri.startsWith('data:application/json')) {
            const base64Data = uri.split(',')[1];
            metadata = JSON.parse(atob(base64Data));
          } else if (uri.startsWith('/')) {
            const res = await fetch(uri);
            if (res.ok) metadata = await res.json();
          }
        } catch (e) {
          // IPFS or network fetch failed, will use fallback below
        }

        // Resilient fallback to local metadata
        if (!metadata) {
          try {
            const res = await fetch(`/metadata/${i}.json`);
            if (res.ok) {
              metadata = await res.json();
            }
          } catch (err) {
            console.warn(`Local metadata for #${i} could not be loaded.`);
          }
        }

        if (metadata) {
          // Merge on-chain escrow state
          try {
            const isListed = await escrowContract.isListed(i);
            const price = await escrowContract.purchasePrice(i);
            const escrowAmt = await escrowContract.escrowAmount(i);
            const buyer = await escrowContract.buyer(i);
            const inspectionPassed = await escrowContract.inspectionPassed(i);

            metadata.onChain = {
              isListed,
              purchasePrice: ethers.utils.formatEther(price),
              escrowAmount: ethers.utils.formatEther(escrowAmt),
              buyer,
              inspectionPassed
            };
          } catch (escErr) {
            // escrow query skipped
          }

          metadata.id = i.toString();
          loadedHomes.push(metadata);
        }
      }

      setHomes(loadedHomes);

      // Listen to MetaMask account changes
      if (window.ethereum) {
        window.ethereum.removeAllListeners?.('accountsChanged');
        window.ethereum.removeAllListeners?.('chainChanged');

        window.ethereum.on('accountsChanged', async (accs) => {
          if (accs.length > 0) {
            const acc = ethers.utils.getAddress(accs[0]);
            setAccount(acc);
            const bal = await activeProvider.getBalance(acc);
            setBalance(parseFloat(ethers.utils.formatEther(bal)).toFixed(3));
          } else {
            setAccount(null);
            setBalance(null);
          }
        });

        window.ethereum.on('chainChanged', () => {
          window.location.reload();
        });
      }

    } catch (globalErr) {
      console.error("Initialization error:", globalErr);
      setErrorBanner("Could not connect to Ethereum node. Please make sure Hardhat node is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  const togglePop = (home) => {
    setSelectedHome(home);
    setIsHomeModalOpen(!isHomeModalOpen);
  };

  // Filter and Sort properties
  const filteredHomes = useMemo(() => {
    return homes.filter((home) => {
      // 1. Text Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = home.name?.toLowerCase().includes(query);
        const matchesAddress = home.address?.toLowerCase().includes(query);
        const matchesDesc = home.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress && !matchesDesc) return false;
      }

      // 2. Property Type
      if (selectedType !== 'All Types') {
        const resType = home.attributes?.find(a => a.trait_type === "Type of Residence")?.value;
        if (resType !== selectedType) return false;
      }

      // 3. Price Filter
      const price = home.onChain?.purchasePrice ? parseFloat(home.onChain.purchasePrice) : parseFloat(home.attributes?.[0]?.value || 0);
      if (price > parseFloat(maxPrice)) return false;

      return true;
    }).sort((a, b) => {
      const priceA = a.onChain?.purchasePrice ? parseFloat(a.onChain.purchasePrice) : parseFloat(a.attributes?.[0]?.value || 0);
      const priceB = b.onChain?.purchasePrice ? parseFloat(b.onChain.purchasePrice) : parseFloat(b.attributes?.[0]?.value || 0);
      const sqftA = parseFloat(a.attributes?.find(attr => attr.trait_type === "Square Feet")?.value || 0);
      const sqftB = parseFloat(b.attributes?.find(attr => attr.trait_type === "Square Feet")?.value || 0);

      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      if (sortBy === 'sqft-desc') return sqftB - sqftA;
      return 0; // featured
    });
  }, [homes, searchTerm, selectedType, maxPrice, sortBy]);

  const currentRoles = (config[chainId] || config['31337'])?.roles || {};

  return (
    <div className="app-container">
      {/* Top Banner if warning */}
      {errorBanner && (
        <div className="global-warning-banner">
          <span>⚠️ {errorBanner}</span>
          <button onClick={switchNetworkToLocalhost} className="banner-action-btn">
            Connect to Localhost 31337
          </button>
        </div>
      )}

      {/* Navigation */}
      <Navigation 
        account={account} 
        setAccount={setAccount} 
        balance={balance}
        networkName={networkName}
        chainId={chainId}
        roles={currentRoles}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
        onOpenListModal={() => setIsListModalOpen(true)}
        onSwitchNetwork={switchNetworkToLocalhost}
      />

      {/* Hero with Search and Filters */}
      <Search 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        sortBy={sortBy}
        setSortBy={setSortBy}
        propertyCount={homes.length}
        onOpenListModal={() => setIsListModalOpen(true)}
      />

      {/* Property Cards Section */}
      <main className="marketplace-section">
        <div className="marketplace-header">
          <div>
            <h2 className="marketplace-title">Featured Luxury Estates</h2>
            <p className="marketplace-subtitle">
              Tokenized real estate assets under cryptographic escrow control. Click any property to inspect escrow status and execute participant actions.
            </p>
          </div>
          <div className="results-count-badge">
            <span>Showing <strong>{filteredHomes.length}</strong> of {homes.length} estates</span>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Connecting to Smart Contracts & Syncing On-Chain Records...</p>
          </div>
        ) : filteredHomes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏰</span>
            <h3>No Properties Match Your Filter</h3>
            <p>Try resetting the search keyword or increasing the maximum price slider.</p>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setSearchTerm('');
                setSelectedType('All Types');
                setMaxPrice(50);
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="property-grid">
            {filteredHomes.map((home, index) => {
              const price = home.onChain?.purchasePrice || home.attributes?.[0]?.value;
              const beds = home.attributes?.find(a => a.trait_type === "Bed Rooms")?.value;
              const baths = home.attributes?.find(a => a.trait_type === "Bathrooms")?.value;
              const sqft = home.attributes?.find(a => a.trait_type === "Square Feet")?.value;
              const resType = home.attributes?.find(a => a.trait_type === "Type of Residence")?.value || "Estate";
              const isListed = home.onChain ? home.onChain.isListed : true;

              return (
                <div 
                  className="property-card" 
                  key={index} 
                  onClick={() => togglePop(home)}
                  tabIndex="0"
                  role="button"
                  onKeyDown={(e) => { if (e.key === 'Enter') togglePop(home); }}
                >
                  <div className="property-card__image-container">
                    <img src={home.image} alt={home.name} className="property-card__image" loading="lazy" />
                    
                    {/* Floating Badges */}
                    <div className="property-card__badges-top">
                      <span className="badge-type">{resType}</span>
                      <span className={`badge-pill ${isListed ? 'badge-pill--active' : 'badge-pill--sold'}`}>
                        {isListed ? '🟢 In Escrow' : '🏆 Title Transferred'}
                      </span>
                    </div>

                    <div className="property-card__badge-bottom">
                      <span className="token-id-tag">NFT #{home.id}</span>
                    </div>
                  </div>

                  <div className="property-card__body">
                    <div className="property-card__price-row">
                      <div className="property-card__price">
                        <span className="eth-symbol">Ξ</span>
                        <span className="eth-value">{price}</span>
                        <span className="eth-unit">ETH</span>
                      </div>
                      <span className="usd-estimate">
                        ≈ ${(parseFloat(price || 0) * 3200).toLocaleString()} USD
                      </span>
                    </div>

                    <h3 className="property-card__title">{home.name}</h3>
                    <p className="property-card__address">📍 {home.address}</p>

                    <div className="property-card__specs-row">
                      <div className="spec-item">
                        <span className="spec-val">{beds}</span>
                        <span className="spec-lbl">Beds</span>
                      </div>
                      <span className="spec-sep">•</span>
                      <div className="spec-item">
                        <span className="spec-val">{baths}</span>
                        <span className="spec-lbl">Baths</span>
                      </div>
                      <span className="spec-sep">•</span>
                      <div className="spec-item">
                        <span className="spec-val">{sqft}</span>
                        <span className="spec-lbl">sqft</span>
                      </div>
                    </div>

                    <div className="property-card__footer">
                      <button className="card-inspect-btn">
                        <span>Inspect Escrow & Actions</span>
                        <span className="arrow-icon">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Property Details Modal */}
      {isHomeModalOpen && selectedHome && (
        <Home 
          home={selectedHome} 
          provider={provider} 
          account={account} 
          escrow={escrow} 
          realEstate={realEstate}
          roles={currentRoles}
          togglePop={() => setIsHomeModalOpen(false)} 
          onOpenRoleModal={() => {
            setIsHomeModalOpen(false);
            setIsRoleModalOpen(true);
          }}
        />
      )}

      {/* Role Testing Hub Modal */}
      {isRoleModalOpen && (
        <RoleSwitcher 
          currentAccount={account}
          onClose={() => setIsRoleModalOpen(false)}
          onSelectAccount={(selectedAddress) => {
            setAccount(selectedAddress);
          }}
        />
      )}

      {/* List Property Modal */}
      <ListPropertyModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        realEstate={realEstate}
        escrow={escrow}
        provider={provider}
        account={account}
        roles={currentRoles}
        onPropertyAdded={loadBlockchainData}
      />

      {/* Footer */}
      <footer className="footer">
        <div className="footer__content">
          <div className="footer__brand">
            <span className="footer__brand-title">MILLOW ESCROW PROTOCOL</span>
            <p>Next-generation on-chain decentralized real estate escrow powered by Ethereum ERC-721 smart contracts.</p>
          </div>
          <div className="footer__links">
            <button onClick={() => setIsRoleModalOpen(true)} className="footer-link-btn">
              Role Testing Hub
            </button>
            <button onClick={() => setIsListModalOpen(true)} className="footer-link-btn">
              Mint & List Property
            </button>
            <a href="https://ethereum.org" target="_blank" rel="noreferrer" className="footer-link-btn">
              Ethereum Docs
            </a>
          </div>
        </div>
        <div className="footer__bottom">
          <span>Millow Decentralized Escrow • Zero Brokerage • Peer to Peer Title Settlement</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
