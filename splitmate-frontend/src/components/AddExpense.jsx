import React, { useState, useEffect } from "react";
import styles from "../styles/addExpense.module.css";
import { addExpense } from "../api/expenses";
import { useGroups } from "../context/GroupContext";
import { getAllFriends } from "../api/friends";

export default function AddExpenseModal({
  isOpen,
  onClose,
  onExpenseAdded,
  friendId,
  initialGroupId,
}) {
  const { groups, reloadGroups } = useGroups();

  const lsUser = (() => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return {};
    
    // Decode JWT token to get user data
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    console.log("DEBUG: Decoded token payload:", decoded);
    
    return {
      _id: decoded.userID,
      id: decoded.userID,
      name: decoded.name,
      email: decoded.email
    };
  } catch (e) {
    console.error("Failed to decode token:", e);
    return {};
  }
})();

console.log("DEBUG: Extracted user from token:", lsUser);
 

  const myId = String(
     lsUser?._id || ""
  );
  const myName = lsUser?.name || "You";
  console.log("DEBUG: final myId =", myId);


  const [groupId, setGroupId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(myId);
  const [selected, setSelected] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [friends, setFriends] = useState([]);

  const selectedGroup = Array.isArray(groups)
    ? groups.find((g) => g._id === groupId)
    : null;

  // Friend lookup (must be defined before using in uniqueMembers)
  const friendUser =
    friendId && friends.find((f) => String(f._id) === String(friendId));

  // Build members list depending on flow
  let uniqueMembers = [];
  if (friendId) {
    if (friendUser) {
      uniqueMembers = [
        { _id: myId, name: myName },
        { _id: friendUser._id, name: friendUser.name, email: friendUser.email },
      ];
    } else {
      uniqueMembers = [{ _id: myId, name: myName }];
    }
  } else if (selectedGroup) {
    // Dedupe by _id and ensure we have the current user data
    const memberMap = new Map();

    // Add current user first
    memberMap.set(myId, { _id: myId, name: myName, email: lsUser?.email });

    // Add other members
    (selectedGroup.members || []).forEach((m) => {
      if (m && m._id) {
        memberMap.set(String(m._id), {
          _id: String(m._id),
          name: m.name || m.email || m._id,
          email: m.email,
        });
      }
    });

    uniqueMembers = Array.from(memberMap.values());
  }
  console.log("DEBUG: myId =", myId);
  console.log("DEBUG: uniqueMembers =", uniqueMembers);

  // Exclude current user for "With you and …" - use strict comparison
  const otherMembers = uniqueMembers.filter((u) => {
    const userId = String(u._id);
    return userId !== myId && userId !== "";
  });

  console.log("DEBUG: otherMembers =", otherMembers);

  // Fetch friends when needed
  useEffect(() => {
    if (!isOpen || !friendId) return;
    (async () => {
      try {
        const list = await getAllFriends();
        setFriends(list);
      } catch (err) {
        console.error("Failed to fetch friends:", err);
      }
    })();
  }, [isOpen, friendId]);

  // Initialize when modal opens - fix the group selection logic
  useEffect(() => {
    if (!isOpen) return;

    if (friendId) {
      setGroupId("");
      setSelected([friendId]);
      setPaidBy(myId);
    } else if (initialGroupId) {
      setGroupId(initialGroupId);
      const g = groups.find((gg) => gg._id === initialGroupId);

      // Select all OTHER members (exclude yourself)
      const others = (g?.members || [])
        .filter((u) => String(u._id) !== String(myId))
        .map((u) => String(u._id));

      console.log("DEBUG: Auto-selecting others =", others);
      setSelected(others);
      setPaidBy(myId);
    }
  }, [isOpen, friendId, initialGroupId, groups, myId]);
  // Also fix the group selection change handler
  const handleGroupChange = (gid) => {
    setGroupId(gid);
    const g = (groups || []).find((gg) => gg._id === gid);

    // Reset selection to all OTHER members
    const others = (g?.members || [])
      .filter((u) => String(u._id) !== String(myId))
      .map((u) => String(u._id));

    setSelected(others);
    setPaidBy(myId);
  };

  const reset = () => {
    setGroupId("");
    setDescription("");
    setAmount("");
    setPaidBy(myId);
    setSelected([]);
    setDate(new Date().toISOString().slice(0, 10));
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSave = async () => {
    if (!friendId && !groupId)
      return setError("Please select a group");
    if (!description.trim()) return setError("Description is required");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount");
    if (!paidBy) return setError("Select who paid");
    if (selected.length === 0) return setError("Choose at least one member");

    setLoading(true);
    setError("");

    try {
      const payload = {
        description: description.trim(),
        amount: amt,
        paidBy,
        date,
      };

      if (groupId) {
        // Group expense
        const allParticipants = Array.from(new Set([String(myId), ...selected]));
        payload.groupId = groupId;
        payload.splitAmong = allParticipants.map((id) => ({ 
          user: id, 
          share: amt / allParticipants.length 
        }));
      } else if (friendId) {
        // Friend expense (no group)
        payload.participants = [myId, friendId];
        payload.splitAmong = [
          { user: myId, share: amt / 2 },
          { user: friendId, share: amt / 2 }
        ];
      }

      console.log("DEBUG: Payload to save =", payload);

      const data = await addExpense(payload);
      const expense = data.expense || data;

      if (onExpenseAdded) onExpenseAdded(expense);
      reloadGroups();
      handleClose();
    } catch (e) {
       console.log("DEBUG: Error details:", e);
      setError(e?.msg || e?.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span>Add an expense</span>
          <button className={styles.close} onClick={handleClose}>
            &times;
          </button>
        </div>

        {/* Group selector (only if not friend flow) */}
        {!friendId && (
          <div className={styles.section}>
            <label className={styles.label}>Group</label>
            <select
              className={styles.input}
              value={groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={Boolean(initialGroupId)}
            >
              <option value="">Select a group</option>
              {(groups || []).map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Members */}
        {friendId ? (
          <div className={styles.section}>
            <label className={styles.label}>
              With you and{" "}
              {friendUser ? friendUser.name || friendUser.email : "this friend"}
            </label>
          </div>
        ) : otherMembers.length === 1 ? (
          <div className={styles.section}>
            <label className={styles.label}>
              With you and {otherMembers[0]?.name || otherMembers[0]?.email}
            </label>
          </div>
        ) : otherMembers.length > 1 ? (
          <div className={styles.section}>
            <label className={styles.label}>With you and:</label>
            <div className={styles.chips}>
              {otherMembers.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  className={`${styles.chip} ${
                    selected.includes(String(u._id)) ? styles.chipSelected : ""
                  }`}
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(String(u._id))
                        ? prev.filter((x) => x !== String(u._id))
                        : [...prev, String(u._id)]
                    )
                  }
                >
                  {u.name || u.email}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.note}>No members found.</p>
        )}

        {/* Expense fields */}
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <input
              className={styles.input}
              placeholder="Enter a description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Amount</label>
            <input
              className={styles.input}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Paid by + Date */}
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Paid by</label>
            <select
              className={styles.input}
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              {uniqueMembers.map((u) => (
                <option key={u._id} value={u._id}>
                  {String(u._id) === myId ? "You" : u.name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Date</label>
            <input
              className={styles.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {selected.length > 0 && (
          <div className={styles.note}>
            Split equally among {selected.length + 1} member(s)
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={handleClose}>
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            disabled={loading}
            onClick={onSave}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
