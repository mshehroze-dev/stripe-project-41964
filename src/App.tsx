import { Routes, Route } from "react-router-dom";import { Layout } from "./components/layout/Layout";
import Home from "./pages/Home";import Checkout from "./pages/Checkout";
import Success from "./pages/Success";
import Cancel from "./pages/Cancel";
import Billing from "./pages/Billing";import Privacy from "./pages/Privacy";import Terms from "./pages/Terms";import Contact from "./pages/Contact";
export default function App() {
  return (    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />        <Route path="/checkout" element={<Checkout />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/success" element={<Success />} />
        <Route path="/cancel" element={<Cancel />} />          <Route path="/privacy" element={<Privacy />} />  <Route path="/terms" element={<Terms />} />  <Route path="/contact" element={<Contact />} />
      </Routes>
    </Layout>  );
}
