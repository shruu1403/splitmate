import React, { useState, useEffect, useRef } from "react";
import styles from "../styles/AddExpense.module.css";
import { addExpense } from "../api/expenses";
import { useGroups } from "../context/GroupContext";
import { getAllFriends } from "../api/friends";
import AddGroupModal from "./AddGroupModal";
import { LABELS as LABEL_CATALOG } from "../utils/labelCatalog";
import { setExpenseLabel } from "../utils/expenseLabelStore";

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
  const [label, setLabel] = useState("misc");
  const [amount, setAmount] = useState("");
  // Multi-payer support: selected payer IDs and their amounts
  const [payersSelected, setPayersSelected] = useState([myId]);
  const [payerAmounts, setPayerAmounts] = useState({}); // { userId: number }
  const [selected, setSelected] = useState([]);
  const [includeMe, setIncludeMe] = useState(true); // New: whether current user is included in split
  const [splitType, setSplitType] = useState("equal"); // New: equal, exact, percentage, shares
  const [customSplits, setCustomSplits] = useState({}); // New: for exact amounts or percentages
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  // Refs for closing on outside click
  const modalRef = useRef(null);
  const payerRef = useRef(null);
  const splitRef = useRef(null);
  const labelRef = useRef(null);
  const participantsRef = useRef(null);
  // Get current date in IST timezone (UTC+5:30)
  const getCurrentDateIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().slice(0, 10);
  };
  const [date, setDate] = useState(getCurrentDateIST());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [friends, setFriends] = useState([]);
  const [showAddGroup, setShowAddGroup] = useState(false);

  const selectedGroup = Array.isArray(groups)
    ? groups.find((g) => g._id === groupId)
    : null;

  // Labels catalog (frontend-only)
  const categories = LABEL_CATALOG;

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

  // All available members for selection (including current user)
  const allMembers = uniqueMembers;

  // Current participants in the split
  const participantIds = includeMe ? [myId, ...selected] : selected;
  const participants = allMembers.filter(m => participantIds.includes(String(m._id)));

  console.log("DEBUG: participants =", participants);

  // Fetch friends when needed
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
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
    if (typeof window === "undefined") return;  // ✅ SSR safe
    if (!isOpen) return;

    if (friendId) {
      setGroupId("");
      setSelected([friendId]);
      setIncludeMe(true); // Default: include yourself in friend expenses
      setPayersSelected([myId]);
      setPayerAmounts(prev => ({ ...prev, [myId]: parseFloat(amount) || undefined }));
    } else if (initialGroupId) {
      setGroupId(initialGroupId);
      const g = groups.find((gg) => gg._id === initialGroupId);

      // Select all OTHER members (exclude yourself)
      const others = (g?.members || [])
        .filter((u) => String(u._id) !== String(myId))
        .map((u) => String(u._id));

      console.log("DEBUG: Auto-selecting others =", others);
      setSelected(others);
      setIncludeMe(true); // Default: include yourself
      setPayersSelected([myId]);
      setPayerAmounts(prev => ({ ...prev, [myId]: parseFloat(amount) || undefined }));
    }
  }, [isOpen, friendId, initialGroupId, groups, myId]);

  // Control body scroll when modal is open
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe

    if (isOpen) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to ensure body scroll is restored
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close side modals on outside click
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    const handleClickOutside = (e) => {
      // Main add expense modal backdrop close handled below
      if (showPayerModal && payerRef.current && !payerRef.current.contains(e.target)) {
        setShowPayerModal(false);
      }
      if (showSplitModal && splitRef.current && !splitRef.current.contains(e.target)) {
        setShowSplitModal(false);
      }
      if (showLabelModal && labelRef.current && !labelRef.current.contains(e.target)) {
        setShowLabelModal(false);
      }
      if (showParticipantsModal && participantsRef.current && !participantsRef.current.contains(e.target)) {
        setShowParticipantsModal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPayerModal, showSplitModal, showLabelModal, showParticipantsModal]);

  // Toggle helpers to avoid close-then-open flicker when clicking triggers
  const togglePayerModal = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    // Small delay to prevent immediate selection when opening
    setTimeout(() => {
      setShowPayerModal((prev) => {
        const next = !prev;
        if (next) {
          setShowSplitModal(false);
          setShowLabelModal(false);
          setShowParticipantsModal(false);
        }
        return next;
      });
    }, 50);
  };

  const toggleSplitModal = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setTimeout(() => {
      setShowSplitModal((prev) => {
        const next = !prev;
        if (next) {
          setShowPayerModal(false);
          setShowLabelModal(false);
          setShowParticipantsModal(false);
        }
        return next;
      });
    }, 50);
  };

  const toggleLabelModal = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setTimeout(() => {
      setShowLabelModal((prev) => {
        const next = !prev;
        if (next) {
          setShowPayerModal(false);
          setShowSplitModal(false);
          setShowParticipantsModal(false);
        }
        return next;
      });
    }, 50);
  };

  const toggleParticipantsModal = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setTimeout(() => {
      setShowParticipantsModal((prev) => {
        const next = !prev;
        if (next) {
          setShowPayerModal(false);
          setShowSplitModal(false);
          setShowLabelModal(false);
        }
        return next;
      });
    }, 50);
  };

  // Also fix the group selection change handler
  const handleGroupChange = (gid) => {
    setGroupId(gid);
    const g = (groups || []).find((gg) => gg._id === gid);

    // Reset selection to all OTHER members
    const others = (g?.members || [])
      .filter((u) => String(u._id) !== String(myId))
      .map((u) => String(u._id));

    setSelected(others);
    setIncludeMe(true); // Reset to include yourself
    setPayersSelected([myId]);
    setPayerAmounts(prev => ({ ...prev, [myId]: parseFloat(amount) || undefined }));
  };

  const reset = () => {
    setGroupId("");
    setDescription("");
    setLabel("misc");
    setAmount("");
    setPayersSelected([myId]);
    setPayerAmounts({});
    setSelected([]);
    setIncludeMe(true);
    setSplitType("equal");
    setCustomSplits({});
    setDate(getCurrentDateIST());
    setError("");
    setShowAddGroup(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Calculate split amounts based on split type
  const calculateSplitAmounts = (amt, participants) => {
    const splitAmounts = [];

    switch (splitType) {
      case "equal":
        const equalShare = amt / participants.length;
        participants.forEach(p => {
          splitAmounts.push({ user: p._id, share: equalShare });
        });
        break;

      case "exact":
        participants.forEach(p => {
          const customAmount = customSplits[p._id] || 0;
          splitAmounts.push({ user: p._id, share: parseFloat(customAmount) });
        });
        break;

      case "percentage":
        participants.forEach(p => {
          const percentage = customSplits[p._id] || 0;
          const share = (amt * parseFloat(percentage)) / 100;
          splitAmounts.push({ user: p._id, share });
        });
        break;

      case "shares":
        const totalShares = participants.reduce((sum, p) => {
          return sum + (parseFloat(customSplits[p._id]) || 1);
        }, 0);
        participants.forEach(p => {
          const userShares = parseFloat(customSplits[p._id]) || 1;
          const share = (amt * userShares) / totalShares;
          splitAmounts.push({ user: p._id, share });
        });
        break;

      default:
        // Fallback to equal split
        const defaultShare = amt / participants.length;
        participants.forEach(p => {
          splitAmounts.push({ user: p._id, share: defaultShare });
        });
    }

    return splitAmounts;
  };

  // Validate split amounts
  const validateSplit = (amt, participants) => {
    if (splitType === "equal") return true;

    const splitAmounts = calculateSplitAmounts(amt, participants);
    const total = splitAmounts.reduce((sum, split) => sum + split.share, 0);

    switch (splitType) {
      case "exact":
        return Math.abs(total - amt) < 0.01; // Allow for small rounding differences
      case "percentage":
        const totalPercentage = participants.reduce((sum, p) => {
          return sum + (parseFloat(customSplits[p._id]) || 0);
        }, 0);
        return Math.abs(totalPercentage - 100) < 0.01;
      case "shares":
        return true; // Shares are always valid as they're proportional
      default:
        return true;
    }
  };

  const onSave = async () => {
    if (!friendId && !groupId)
      return setError("Please select a group");
    if (!description.trim()) return setError("Description is required");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount");
    // Validate payer selection
    if (!payersSelected || payersSelected.length === 0) return setError("Select at least one payer");

    // For friend expenses, ensure at least one person is selected
    if (friendId && !includeMe && selected.length === 0) {
      return setError("At least someone must be included in the split");
    }

    // For group expenses, ensure at least one person is selected
    if (!friendId && !includeMe && selected.length === 0) {
      return setError("At least someone must be included in the split");
    }

    // Validate split amounts for non-equal splits
    if (!validateSplit(amt, participants)) {
      if (splitType === "exact") {
        return setError("Split amounts must add up to the total expense amount");
      } else if (splitType === "percentage") {
        return setError("Percentages must add up to 100%");
      }
    }

    // If multiple payers are selected, ensure totals line up
    let payersPayload = null;
    if (payersSelected.length === 1) {
      // If only one payer, allow implicit full amount if not set
      const onlyId = payersSelected[0];
      const amtSet = parseFloat(payerAmounts[onlyId]);
      if (!isNaN(amtSet) && amtSet > 0 && Math.abs(amtSet - amt) > 0.01) {
        return setError("Single payer amount should equal total amount");
      }
    } else {
      // Multi payer: every selected must have a non-negative number, totals must match
      let sum = 0;
      for (const uid of payersSelected) {
        const val = parseFloat(payerAmounts[uid]);
        if (isNaN(val) || val < 0) return setError("Enter valid amounts for each payer");
        sum += val;
      }
      if (Math.abs(sum - amt) > 0.01) return setError("Sum of payer amounts must equal total amount");
      payersPayload = payersSelected.map(uid => ({ user: uid, amount: parseFloat(payerAmounts[uid]) }));
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        description: description.trim(),
        amount: amt,
        // Backward compatible: if only one payer selected, use single paidBy, else send payers[]
        ...(payersSelected.length === 1
          ? { paidBy: payersSelected[0] }
          : { payers: payersPayload }
        ),
        date,
      };

      if (groupId) {
        // Group expense
        const allParticipants = includeMe ? [myId, ...selected] : selected;
        const participantObjects = allMembers.filter(m => allParticipants.includes(String(m._id)));

        payload.groupId = groupId;
        payload.splitAmong = calculateSplitAmounts(amt, participantObjects);
      } else if (friendId) {
        // Friend expense (no group)
        const allParticipants = includeMe ? [myId, friendId] : [friendId];
        const participantObjects = allMembers.filter(m => allParticipants.includes(String(m._id)));

        payload.participants = allParticipants;
        payload.splitAmong = calculateSplitAmounts(amt, participantObjects);
      }

      console.log("DEBUG: Payload to save =", payload);

      const data = await addExpense(payload);
      const expense = data.expense || data;

      // Persist UI label mapping for this expense (frontend-only)
      try {
        if (expense && expense._id && label) {
          setExpenseLabel(expense._id, label);
        }
      } catch {}

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const tag = e.target.tagName;
      const type = e.target.type;
      if (tag === 'TEXTAREA') return;
      if (tag === 'BUTTON' && type !== 'submit') return;
      e.preventDefault();
      onSave();
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={(e) => {
      // Close when clicking the dim backdrop (outside the modal box)
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        handleClose();
      }
    }}>
      <div className={styles.modal} onKeyDown={handleKeyDown} ref={modalRef}>
        <div className={styles.header}>
          <span className={styles.heading}>Add an expense</span>
          <button className={styles.close} onClick={handleClose}>
            &times;
          </button>
        </div>

        {/* Group selector: show only on All Expenses (no friend flow, no initialGroupId) */}
        {!friendId && !initialGroupId && (
          <div className={`${styles.section} ${styles.inlineField}`}>
            {/* <span className={styles.pillHeading}>Group</span> */}
            <select
              className={styles.input}
              value={groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={false}
            >
              <option value="">Select a group</option>
              {(groups || []).map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.addGroupBtn}
              onClick={() => setShowAddGroup(true)}
            >
              + New Group
            </button>
          </div>
        )}

        {/* Participants summary -> opens side modal */}
        <div className={styles.section}>
          <div className={styles.summaryLine}>
            <span className={styles.participants}>Participants:</span>
            <button
              type="button"
              className={styles.inlineLink}
              onMouseDown={toggleParticipantsModal}
              onTouchStart={toggleParticipantsModal}
            >
              {(() => {
                if (friendId) {
                  const fname = friendUser ? (friendUser.name || friendUser.email) : "friend";
                  if (includeMe && selected.includes(String(friendId))) return `you and ${fname}`;
                  if (includeMe) return "you";
                  if (selected.includes(String(friendId))) return fname;
                  return "choose";
                }
                if (!selectedGroup) return "choose";
                const others = (selectedGroup.members || []).filter((u) => String(u._id) !== String(myId));
                const allOthersSelected = selected.length === others.length && others.every(o => selected.includes(String(o._id)));
                if (includeMe && allOthersSelected) return `All of "${selectedGroup.name}"`;
                const count = selected.length + (includeMe ? 1 : 0);
                if (count === 0) return "choose";
                if (includeMe && selected.length === 0) return "you";
                return includeMe ? `you + ${selected.length} more` : `${selected.length} member(s)`;
              })()}
            </button>
          </div>
        </div>

        {/* Label square + description/amount stacked (like Splitwise) */}
        <div className={styles.labelAndInputs}>
          <button
            type="button"
            className={styles.labelTile}
            onClick={toggleLabelModal}
            title="Choose label"
          >
            {(() => {
              const cur = categories.find((c) => c.key === label);
              if (cur?.img) {
                return (
                  <img
                    src={cur.img}
                    alt={cur.label}
                    onError={(e) => {
                      if (cur.imgFallback && e.currentTarget.src !== window.location.origin + cur.imgFallback) {
                        e.currentTarget.src = cur.imgFallback;
                      } else {
                        e.currentTarget.replaceWith(document.createTextNode("📦"));
                      }
                    }}
                  />
                );
              }
              return cur?.icon || "📦";
            })()}
          </button>
          <div className={styles.inputsCol}>
            <input
              className={styles.input}
              placeholder="Enter a description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              className={styles.input}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>

        {/* Description/amount already with label tile above */}

        {/* Summary row like Splitwise */}
        <div className={styles.section}>
          <div className={`${styles.summaryLine} ${styles.summaryCenter}`}>
            <span>Paid by </span>
            <button
              type="button"
              className={styles.inlineLink}
              onClick={togglePayerModal}
            >
              {(() => {
                if (payersSelected.length === 1) {
                  const only = payersSelected[0];
                  if (only === myId) return "you";
                  const m = allMembers.find(m => String(m._id) === String(only));
                  return m?.name || m?.email || "someone";
                }
                if (payersSelected.length === 0) return "choose";
                const hasMe = payersSelected.includes(myId);
                const others = payersSelected.length - (hasMe ? 1 : 0);
                return hasMe ? `you + ${others} more` : `${payersSelected.length} people`;
              })()}
            </button>
            <span> and split </span>
            <button
              type="button"
              className={styles.inlineLink}
              onClick={toggleSplitModal}
            >
              {splitType === "equal" ? "equally" : splitType}
            </button>
          </div>
          {splitType === "equal" && participants.length > 0 && amount && (
            <div className={styles.perPersonNote}>
              (₹{(parseFloat(amount) / participants.length).toFixed(2)}/person)
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div className={styles.note}>
            {splitType === "equal"
              ? <>Split equally among {participants.length} participant(s)</>
              : <>Split using {splitType} among {participants.length} participant(s)</>}
          </div>
        )}
        {/* Date */}
        <div className={`${styles.section} ${styles.centerRow}`}>
          {/* <label className={styles.label}>Date</label> */}
          <input
            className={`${styles.input} ${styles.narrowInput}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>



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

        {/* Add Group Modal */}
        <AddGroupModal
          isOpen={showAddGroup}
          onClose={() => setShowAddGroup(false)}
          onGroupAdded={async (newGroup) => {
            console.log("New group created:", newGroup);
            setShowAddGroup(false); // Close the modal first

            // Reload groups and wait for it to complete
            await reloadGroups();

            // Small delay to ensure groups state is updated
            setTimeout(() => {
              setGroupId(newGroup._id); // Auto-select the new group

              // Find the group in the updated groups list to get full member data
              const updatedGroup = groups.find(g => g._id === newGroup._id);
              if (updatedGroup && updatedGroup.members) {
                // Auto-select all group members (excluding yourself)
                const others = updatedGroup.members
                  .filter((u) => String(u._id) !== String(myId))
                  .map((u) => String(u._id));
                console.log("Auto-selecting members:", others);
                setSelected(others);
              }

              setIncludeMe(true);
              setPayersSelected([myId]);
              setPayerAmounts(prev => ({ ...prev, [myId]: parseFloat(amount) || undefined }));
            }, 100);
          }}
        />

        {/* Backdrop for side modals on mobile */}
        {(showPayerModal || showSplitModal || showLabelModal || showParticipantsModal) && (
          <div className={styles.sideModalBackdrop} onClick={() => {
            setShowPayerModal(false);
            setShowSplitModal(false);
            setShowLabelModal(false);
            setShowParticipantsModal(false);
          }} />
        )}

        {/* Payer chooser modal */}
        {showPayerModal && (
          <div className={styles.sideModal} ref={payerRef}>
            <div className={styles.miniHeader}>
              <span>Choose payer</span>
              <button className={styles.close} onClick={() => setShowPayerModal(false)}>&times;</button>
            </div>
            <div className={styles.optionList}>
                {uniqueMembers.map((u) => {
                const uid = String(u._id);
                const isSelected = payersSelected.includes(uid);
                return (
                    <div key={uid} className={styles.optionRowSpace}>
                    <label className={styles.checkboxLabel} style={{ flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPayersSelected((prev) => Array.from(new Set([...prev, uid])));
                            setPayerAmounts((prev) => ({ ...prev, [uid]: prev[uid] ?? "" }));
                          } else {
                            setPayersSelected((prev) => prev.filter((id) => id !== uid));
                            setPayerAmounts((prev) => {
                              const copy = { ...prev };
                              delete copy[uid];
                              return copy;
                            });
                          }
                        }}
                      />
                      {uid === myId ? "You" : u.name || u.email}
                    </label>
                    {payersSelected.length > 1 && isSelected && (
                      <input
                        type="number"
                        step="0.01"
                        className={styles.customSplitInput}
                        placeholder="0.00"
                        value={payerAmounts[uid] ?? ""}
                        onChange={(e) => setPayerAmounts((prev) => ({ ...prev, [uid]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {payersSelected.length > 1 && (
              <div className={styles.splitSummary}>
                <span>
                  Paid total: ₹{payersSelected.reduce((sum, uid) => sum + (parseFloat(payerAmounts[uid]) || 0), 0).toFixed(2)} / ₹{amount ? parseFloat(amount).toFixed(2) : "0.00"}
                </span>
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => {
                      const count = payersSelected.length;
                      const amtNum = parseFloat(amount) || 0;
                      if (count > 0 && amtNum > 0) {
                        const equal = +(amtNum / count).toFixed(2);
                        const updated = {};
                        payersSelected.forEach((uid, idx) => {
                          updated[uid] = idx === count - 1 ? +(amtNum - equal * (count - 1)).toFixed(2) : equal;
                        });
                        setPayerAmounts(updated);
                      }
                    }}
                  >Distribute equally</button>
                </div>
              </div>
            )}
            <div className={styles.footer}>
              <button className={styles.btnGhost} onClick={() => setShowPayerModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={() => setShowPayerModal(false)}>Done</button>
            </div>
          </div>
        )}

        {/* Split chooser modal */}
        {showSplitModal && (
          <div className={styles.sideModal} ref={splitRef}>
            <div className={styles.miniHeader}>
              <span>Choose split option</span>
              <button className={styles.close} onClick={() => setShowSplitModal(false)}>&times;</button>
            </div>
            <div className={styles.optionList}>
              {[
                { key: "equal", label: "Split equally" },
                { key: "exact", label: "Split by exact amounts" },
                { key: "percentage", label: "Split by percentages" },
                { key: "shares", label: "Split by shares" },
              ].map(opt => (
                <label key={opt.key} className={styles.optionRow}>
                  <input
                    type="radio"
                    name="splitopt"
                    checked={splitType === opt.key}
                    onChange={() => { setSplitType(opt.key); setCustomSplits({}); }}
                  />
                  <span style={{ marginLeft: 8 }}>{opt.label}</span>
                </label>
              ))}
            </div>
            {splitType !== "equal" && (
              <div className={styles.customSplitSection}>
                {participants.map((p) => (
                  <div key={p._id} className={styles.customSplitRow}>
                    <span className={styles.memberName}>{String(p._id) === myId ? "You" : p.name || p.email}</span>
                    <input
                      type="number"
                      step="0.01"
                      className={styles.customSplitInput}
                      placeholder={splitType === "exact" ? "0.00" : splitType === "percentage" ? "0%" : "1"}
                      value={customSplits[p._id] || ""}
                      onChange={(e) => setCustomSplits(prev => ({ ...prev, [p._id]: e.target.value }))}
                    />
                    {splitType === "percentage" && <span>%</span>}
                    {splitType === "shares" && <span>shares</span>}
                  </div>
                ))}
                {splitType === "exact" && amount && (
                  <div className={styles.splitSummary}>
                    <span>
                      Total: ₹{Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)} / ₹{parseFloat(amount || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {splitType === "percentage" && (
                  <div className={styles.splitSummary}>
                    <span>
                      Total: {Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(1)}% / 100%
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className={styles.footer}>
              <button className={styles.btnGhost} onClick={() => setShowSplitModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={() => setShowSplitModal(false)}>Done</button>
            </div>
          </div>
        )}

        {/* Label chooser side modal */}
        {showLabelModal && (
          <div className={styles.sideModal} ref={labelRef}>
            <div className={styles.miniHeader}>
              <span>Choose label</span>
              <button className={styles.close} onClick={() => setShowLabelModal(false)}>&times;</button>
            </div>
            <div className={styles.labelGrid}>
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={styles.labelCard}
                  onClick={() => { setLabel(c.key); setShowLabelModal(false); }}
                >
                  {c.img ? (
                    <img
                      src={c.img}
                      alt={c.label}
                      className={styles.labelIcon}
                      onError={(e) => {
                        if (c.imgFallback && e.currentTarget.src !== window.location.origin + c.imgFallback) {
                          e.currentTarget.src = c.imgFallback;
                        } else {
                          e.currentTarget.outerHTML = `<span style="font-size:24px">📦</span>`;
                        }
                      }}
                    />
                  ) : (
                    <span className={styles.labelEmoji}>{c.icon}</span>
                  )}
                  <span className={styles.labelName}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Participants chooser side modal */}
        {showParticipantsModal && (
          <div className={styles.sideModal} ref={participantsRef}>
            <div className={styles.miniHeader}>
              <span>Choose participants :</span>
              <button className={styles.close} onClick={() => setShowParticipantsModal(false)}>&times;</button>
            </div>
            <div className={styles.optionList}>
              {/* You toggle */}
              <label className={styles.optionRow}>
                <input type="checkbox" checked={includeMe} onChange={(e) => setIncludeMe(e.target.checked)} />
                <span style={{ marginLeft: 8 }}>You ({myName})</span>
              </label>
              {/* Others */}
              {(friendId ? [friendUser && { _id: friendUser?._id, name: friendUser?.name || friendUser?.email }].filter(Boolean) : allMembers.filter(u => String(u._id) !== myId)).map((u) => (
                <label key={u._id} className={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={selected.includes(String(u._id))}
                    onChange={(e) => {
                      const uid = String(u._id);
                      if (e.target.checked) {
                        setSelected((prev) => Array.from(new Set([...prev, uid])));
                      } else {
                        setSelected((prev) => prev.filter((id) => id !== uid));
                      }
                    }}
                  />
                  <span style={{ marginLeft: 8 }}>{u.name || u.email}</span>
                </label>
              ))}
            </div>
            <div className={styles.footer}>
              <button className={styles.btnGhost} onClick={() => setShowParticipantsModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={() => setShowParticipantsModal(false)}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
