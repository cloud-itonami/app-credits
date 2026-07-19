// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GCCStablecoin
/// @notice USDC/FIATToken系の運用モデルを参考にした決済向けERC-20。
/// @dev SafeをmasterMinter/owner運用にすることで、Safeから発行統制できる。
contract GCCStablecoin {
    // ERC-20 metadata
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    uint256 public immutable supplyCap;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // USDC-like roles
    address public owner;
    address public masterMinter;
    address public pauser;
    address public blacklister;

    bool public paused;
    mapping(address => bool) public isBlacklisted;
    mapping(address => bool) public isMinter;
    mapping(address => uint256) public minterAllowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MasterMinterChanged(address indexed newMasterMinter);
    event PauserChanged(address indexed newPauser);
    event BlacklisterChanged(address indexed newBlacklister);

    event Pause();
    event Unpause();
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);

    event MinterConfigured(address indexed minter, uint256 minterAllowedAmount);
    event MinterRemoved(address indexed oldMinter);
    event Mint(address indexed minter, address indexed to, uint256 amount);
    event Burn(address indexed minter, uint256 amount);

    error NotOwner();
    error NotMasterMinter();
    error NotPauser();
    error NotBlacklister();
    error NotMinter();
    error ZeroAddress();
    error PausedError();
    error BlacklistedError(address account);
    error CapExceeded();
    error MinterAllowanceExceeded();
    error InsufficientBalance();
    error InsufficientAllowance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMasterMinter() {
        if (msg.sender != masterMinter) revert NotMasterMinter();
        _;
    }

    modifier onlyPauser() {
        if (msg.sender != pauser) revert NotPauser();
        _;
    }

    modifier onlyBlacklister() {
        if (msg.sender != blacklister) revert NotBlacklister();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier notBlacklisted(address account) {
        if (isBlacklisted[account]) revert BlacklistedError(account);
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 supplyCap_,
        address owner_,
        address masterMinter_,
        address pauser_,
        address blacklister_
    ) {
        if (
            owner_ == address(0) ||
            masterMinter_ == address(0) ||
            pauser_ == address(0) ||
            blacklister_ == address(0)
        ) revert ZeroAddress();
        if (supplyCap_ == 0) revert CapExceeded();

        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        supplyCap = supplyCap_;

        owner = owner_;
        masterMinter = masterMinter_;
        pauser = pauser_;
        blacklister = blacklister_;

        emit OwnershipTransferred(address(0), owner_);
        emit MasterMinterChanged(masterMinter_);
        emit PauserChanged(pauser_);
        emit BlacklisterChanged(blacklister_);
    }

    function transfer(address to, uint256 amount)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(to)
        returns (bool)
    {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(spender)
        returns (bool)
    {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(from)
        notBlacklisted(to)
        returns (bool)
    {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();

        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(spender)
        returns (bool)
    {
        uint256 newAllowance = allowance[msg.sender][spender] + addedValue;
        allowance[msg.sender][spender] = newAllowance;
        emit Approval(msg.sender, spender, newAllowance);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(spender)
        returns (bool)
    {
        uint256 currentAllowance = allowance[msg.sender][spender];
        if (currentAllowance < subtractedValue) revert InsufficientAllowance();

        uint256 newAllowance = currentAllowance - subtractedValue;
        allowance[msg.sender][spender] = newAllowance;
        emit Approval(msg.sender, spender, newAllowance);
        return true;
    }

    /// @notice USDC同様、masterMinterがミンター権限と上限を設定。
    function configureMinter(address minter, uint256 minterAllowedAmount)
        external
        onlyMasterMinter
        notBlacklisted(minter)
        returns (bool)
    {
        if (minter == address(0)) revert ZeroAddress();
        isMinter[minter] = true;
        minterAllowance[minter] = minterAllowedAmount;

        emit MinterConfigured(minter, minterAllowedAmount);
        return true;
    }

    function removeMinter(address minter) external onlyMasterMinter returns (bool) {
        isMinter[minter] = false;
        minterAllowance[minter] = 0;

        emit MinterRemoved(minter);
        return true;
    }

    /// @notice 発行はミンター許容量内のみ可能。SafeをmasterMinterにする運用を想定。
    function mint(address to, uint256 amount)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(to)
        returns (bool)
    {
        if (!isMinter[msg.sender]) revert NotMinter();
        if (amount > minterAllowance[msg.sender]) revert MinterAllowanceExceeded();

        uint256 newTotalSupply = totalSupply + amount;
        if (newTotalSupply > supplyCap) revert CapExceeded();

        minterAllowance[msg.sender] -= amount;
        totalSupply = newTotalSupply;
        balanceOf[to] += amount;

        emit Mint(msg.sender, to, amount);
        emit Transfer(address(0), to, amount);
        return true;
    }

    /// @notice ミンター自身のバーンのみ許可（通常運用では使わない想定）。
    function burn(uint256 amount)
        external
        whenNotPaused
        notBlacklisted(msg.sender)
        returns (bool)
    {
        if (!isMinter[msg.sender]) revert NotMinter();
        uint256 accountBalance = balanceOf[msg.sender];
        if (accountBalance < amount) revert InsufficientBalance();

        balanceOf[msg.sender] = accountBalance - amount;
        totalSupply -= amount;

        emit Burn(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
        return true;
    }

    function pause() external onlyPauser {
        paused = true;
        emit Pause();
    }

    function unpause() external onlyPauser {
        paused = false;
        emit Unpause();
    }

    function blacklist(address account) external onlyBlacklister {
        isBlacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unBlacklist(address account) external onlyBlacklister {
        isBlacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    function updateMasterMinter(address newMasterMinter) external onlyOwner {
        if (newMasterMinter == address(0)) revert ZeroAddress();
        masterMinter = newMasterMinter;
        emit MasterMinterChanged(newMasterMinter);
    }

    function updatePauser(address newPauser) external onlyOwner {
        if (newPauser == address(0)) revert ZeroAddress();
        pauser = newPauser;
        emit PauserChanged(newPauser);
    }

    function updateBlacklister(address newBlacklister) external onlyOwner {
        if (newBlacklister == address(0)) revert ZeroAddress();
        blacklister = newBlacklister;
        emit BlacklisterChanged(newBlacklister);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
