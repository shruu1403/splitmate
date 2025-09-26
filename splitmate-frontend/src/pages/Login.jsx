import React, { useContext, useState,useEffect } from "react";
import { loginUser } from "../api/auth";
import { useNavigate } from "react-router-dom";
import styles from "../styles/login.module.css";
import googleLogo from "../assets/images/google-logo.png";
import { AuthContext } from "../context/AuthContext";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();


  useEffect(() => {
  const handleMessage = (event) => {
    // only accept from your backend
    if (event.origin !== "http://localhost:8080") return;

    if (event.data.token) {
      // save token and login
      // localStorage.setItem("token", event.data.token);
      login(event.data.token); // from AuthContext
      navigate("/dashboard"); // redirect to dashboard
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}, [login,navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginUser(formData);
       if (res.token) {
        // localStorage.setItem("token", res.token);
        login(res.token);
        navigate("/dashboard");
       }else {
        setError(res.msg || "Login failed");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.open(
      "http://localhost:8080/api/auth/google",
      "_blank",
      "width=500,height=600"
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Login</h2>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className={styles.inputField}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className={styles.inputField}
            required
          />

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className={styles.orContainer}>
          <hr />
          <span>or</span>
          <hr />
        </div>

        <button onClick={handleGoogleLogin} className={styles.googleBtn}>
          <img src={googleLogo} alt="Google" />
          Sign in with Google
        </button>

        <div className={styles.link} onClick={() => navigate("/register")}>
          Don’t have an account? Register
        </div>
      </div>
    </div>
  );
};

export default Login;
