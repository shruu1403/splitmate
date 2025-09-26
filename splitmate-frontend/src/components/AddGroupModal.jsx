import React, { useState, useEffect, useContext } from "react";
import { getAllFriends } from "../api/friends";
import { createGroups } from "../api/groups";
import styles from "../styles/addGroupModal.module.css";
import { AuthContext } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";

export default function AddGroupModal({ isOpen, onClose }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);

  const { user } = useContext(AuthContext);
  const { reloadGroups } = useGroups();

  // Pre-fill creator when modal opens
  useEffect(() => {
    if (isOpen && user && members.length === 0) {
      setMembers([
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          locked: true, // creator row
        },
      ]);
    }
  }, [isOpen, user]);

  const handleChange = async (index, value) => {
    setActiveIndex(index);

    if (value.length > 0) {
      try {
        const results = await getAllFriends(value);
        // Filter out already selected friends
        const selectedIds = members.map((m) => m._id);
        setSuggestions(results.filter((r) => !selectedIds.includes(r._id)));
      } catch (err) {
        console.error(err);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectFriend = (index, friend) => {
    const updated = [...members];
    updated[index] = { ...friend, locked: false };
    setMembers(updated);
    setSuggestions([]);
    setActiveIndex(null);
  };

  const addMemberField = () =>
    setMembers([...members, { name: "", email: "" }]);

  const removeMemberField = (i) =>
    setMembers(members.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // exclude creator before sending
      const filteredMembers = members
        .filter((m) => !m.locked) // skip the pre-filled creator row
        .map((m) => m._id);
      await createGroups({
        name,
        members: filteredMembers,
      });
      reloadGroups();

      // reset state
      setName("");
      setMembers([
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          locked: true,
        },
      ]);
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Could not create group. Try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2>Create Group</h2>

          <label>
            Group Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <h3>Group Members</h3>
          {members.map((m, i) => (
            <div key={i} className={styles.memberRow}>
              <div style={{ position: "relative", flex: 1 }}>
                {m._id ? (
                  // Already selected friend
                  <input value={`${m.name} (${m.email})`} disabled />
                ) : (
                  // Typing to search
                  <input
                    value={m.email || ""}
                    onChange={(e) => handleChange(i, e.target.value)}
                    placeholder="Type a name or email"
                  />
                )}

                {/* Suggestions dropdown (per row) */}
                {activeIndex === i && suggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {suggestions.map((s) => (
                      <div key={s._id} onClick={() => handleSelectFriend(i, s)}>
                        {s.name} ({s.email})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!m.locked && (
                <button type="button" onClick={() => removeMemberField(i)}>
                  ❌
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addMemberField}>
            + Add a person
          </button>

          <div className={styles.actions}>
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
