// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IAavegotchi {
    function getOwnerGotchiLendingsLength(address _lender, bytes32 _status)
        external
        view
        returns (uint256);

    function isPetOperatorForAll(address _owner, address _operator)
        external
        view
        returns (bool approved_);

    function tokenIdsOfOwner(address _owner)
        external
        view
        returns (uint32[] memory tokenIds_);
}

contract Feeer is Ownable {
    address diamond = 0x86935F11C86623deC8a25696E1C19a8659CbF95d;
    address wmatic = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    address petter = 0x290000C417a1DE505eb08b7E32b3e8dA878D194E;

    uint256 constant MAX_INT =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    uint256 gotchisPerMatic = 5;
    address wmaticReceiver = 0x5ecf70427aA12Cd0a2f155acbB7d29e7d15dc771;

    address[] private users;
    mapping(address => uint256) private usersToIndex;
    mapping(address => uint256) private userToLastFeeTimestamp;
    mapping(address => uint256) private userToWmaticPaid;

    mapping(address => bool) private isApproved;

    constructor() {
        // Mandatory, index 0 cannot be empty
        _addUser(0x86935F11C86623deC8a25696E1C19a8659CbF95d);

        // Add owner as approved
        isApproved[msg.sender] = true;
    }

    modifier onlyApproved() {
        require(
            msg.sender == owner() || isApproved[msg.sender],
            "Feeer: Not Approved"
        );
        _;
    }

    function getIsSignedUp(address _user) external view returns (bool) {
        return usersToIndex[_user] > 0;
    }

    function getUserLastFeeTimestamp(address _user)
        external
        view
        returns (uint256)
    {
        return userToLastFeeTimestamp[_user];
    }

    function getUserWmaticPaid(address _user) external view returns (uint256) {
        return userToWmaticPaid[_user];
    }

    function hasApprovedGotchiInteraction(address _user)
        public
        view
        returns (bool)
    {
        return IAavegotchi(diamond).isPetOperatorForAll(_user, petter);
    }

    function getIsApproved(address _user) public view returns (bool) {
        return isApproved[_user];
    }

    function getUsers() external view returns (address[] memory) {
        return users;
    }

    function getUsersCount() external view returns (uint256) {
        return users.length - 1;
    }

    function getUsersIndexed(uint256 _pointer, uint256 _amount)
        external
        view
        returns (address[] memory)
    {
        address[] memory addresses = new address[](_amount);
        for (uint256 i = 0; i < _amount; i++) {
            uint256 pointer = _pointer + i;
            if (pointer > users.length) break;
            addresses[i] = users[pointer];
        }
        return addresses;
    }

    function getUsersToIndex(address _user) external view returns (uint256) {
        return usersToIndex[_user];
    }

    function getWmaticEstimation(uint256 _amountGochis)
        public
        view
        returns (uint256)
    {
        return ((_amountGochis / gotchisPerMatic) + 1) * 10**18;
    }

    function getAmountGotchis(address _user) public view returns (uint256) {
        // Amount of gotchis in the wallet
        uint32[] memory tokenIds = IAavegotchi(diamond).tokenIdsOfOwner(_user);
        // Amount of gotchis lent
        uint256 lentGotchis = IAavegotchi(diamond).getOwnerGotchiLendingsLength(
            _user,
            "agreed"
        );
        return tokenIds.length + lentGotchis;
    }

    function getNeedsToPay(address _user) public view returns (bool) {
        uint256 lastFeeTimestamp = userToLastFeeTimestamp[_user];
        return lastFeeTimestamp + 30 days < block.timestamp;
    }

    function getBatchNeedsToPay(address[] calldata _users)
        external
        view
        returns (bool[] memory status_)
    {
        uint256 length = _users.length;
        status_ = new bool[](length);
        for (uint256 i = 0; i < length; ) {
            address user = _users[i];
            status_[i] = getNeedsToPay(user);
            unchecked {
                ++i;
            }
        }
    }

    function getNeedsRegulation(address _user) public view returns (bool) {
        // Get number of gotchis
        uint256 amountGotchis = getAmountGotchis(_user);

        uint256 paidWmatic = userToWmaticPaid[_user];
        uint256 newEstimation = getWmaticEstimation(amountGotchis);

        if (newEstimation > paidWmatic) return true;
        else return false;
    }

    function getBatchNeedsRegulation(address[] calldata _users)
        external
        view
        returns (bool[] memory status_)
    {
        uint256 length = _users.length;
        status_ = new bool[](length);
        for (uint256 i = 0; i < length; ) {
            address user = _users[i];
            status_[i] = getNeedsRegulation(user);
            unchecked {
                ++i;
            }
        }
    }

    /** @notice Can sign up only once
     */
    function signUp() external {
        // Make sure user is not already signed up
        require(usersToIndex[msg.sender] == 0, "Feeer: Already user");

        // Make sure user has set petOperatorForAll
        require(
            hasApprovedGotchiInteraction(msg.sender),
            "Feeer: Didn't set petOperatorForAll"
        );

        // Make him pay
        pay(msg.sender);

        // Add to the user array
        _addUser(msg.sender);
    }

    /** @dev public because bot can remove users
     */
    function leave(address _user) external {
        // Check if the user is a user
        require(usersToIndex[msg.sender] > 0, "Feeer: Not a user");

        // Check if user hmiself or bot
        require(
            msg.sender == _user || getIsApproved(msg.sender),
            "Freeer: Not allowed to remove user"
        );

        // Remove from user array
        _removeUser(msg.sender);
    }

    /** @dev public because used when signing up and by the bot
     */
    function pay(address _user) public {
        // Checking that it has been at least 30 days
        require(getNeedsToPay(_user), "Feeer: 2soon2pay");

        // Get number of gotchis
        uint256 amountGotchis = getAmountGotchis(_user);

        // User must have at least 1 gotchi
        require(amountGotchis > 0, "Feeer: You don't own a gotchi");

        // Save timestamp
        userToLastFeeTimestamp[_user] = block.timestamp;

        // Pay amount
        uint256 amount = getWmaticEstimation(amountGotchis);

        // Save wmatic amount
        userToWmaticPaid[_user] = amount;

        // pay
        bool success = IERC20(wmatic).transferFrom(
            _user,
            wmaticReceiver,
            amount
        );
        require(success, "Freeer: transferFrom failed");
    }

    function regulate(address _user) external {
        require(getNeedsRegulation(_user), "Feeer: No regulation needed");
        // Pro rata calc
        uint256 amountGotchis = getAmountGotchis(_user);
        uint256 daysPassed = block.timestamp -
            userToLastFeeTimestamp[_user] /
            1 days;
        uint256 proRata = ((100 * (30 days - daysPassed)) / 30 days) + 1 days;
        uint256 esimtation = getWmaticEstimation(amountGotchis);
        uint256 wmaticToPay = (proRata * esimtation) / 100;

        // save timestamp
        userToLastFeeTimestamp[_user] = block.timestamp;

        // Transfer the funds
        bool success = IERC20(wmatic).transferFrom(
            _user,
            wmaticReceiver,
            wmaticToPay
        );
        require(success, "Freeer: transferFrom failed");
    }

    /**
        Internal 
    */

    function _addUser(address _newUser) private {
        // No need to add twice the same account
        require(usersToIndex[_newUser] == 0, "Feeer: user already added");

        // Get the index where the new user is in the array (= last position)
        usersToIndex[_newUser] = users.length;

        // Add the user in the array
        users.push(_newUser);
    }

    function _removeUser(address _userLeaver) private {
        // Cant remove an account that is not a user
        require(usersToIndex[_userLeaver] != 0, "Feeer: user already removed");

        // Get the index of the leaver
        uint256 _indexLeaver = usersToIndex[_userLeaver];

        // Get last index
        uint256 lastElementIndex = users.length - 1;

        // Get Last address in array
        address lastAddressInArray = users[lastElementIndex];

        // Move the last address in the position of the leaver
        users[_indexLeaver] = users[lastElementIndex];

        // Change the moved address' index to the new one
        usersToIndex[lastAddressInArray] = _indexLeaver;

        // Remove last entry in the array and reduce length
        users.pop();
        usersToIndex[_userLeaver] = 0;
    }

    /**
        Admin 
    */
    function setIsApproved(address _user, bool _isApproved) external onlyOwner {
        isApproved[_user] = _isApproved;
    }

    function updateGotchisPerMatic(uint256 _amount) external onlyApproved {
        gotchisPerMatic = _amount;
    }
}
