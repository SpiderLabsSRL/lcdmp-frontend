import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import SpecialMenus from "./pages/SpecialMenus";
import Baking from "./pages/Baking";
import Assembly from "./pages/Assembly";
import Decoration from "./pages/Decoration";
import Delivery from "./pages/Delivery";
import Restock from "./pages/Restock";
import CashRegister from "./pages/CashRegister";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute requiredRoles={['admin', 'seller']}><Sales /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute requiredRoles={['admin', 'seller']}><Orders /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute requiredRoles={['admin', 'seller']}><Products /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute requiredRoles={['admin']}><Inventory /></ProtectedRoute>} />
            <Route path="/special-menus" element={<ProtectedRoute requiredRoles={['admin', 'seller']}><SpecialMenus /></ProtectedRoute>} />
            <Route path="/baking" element={<ProtectedRoute requiredRoles={['admin', 'baker']}><Baking /></ProtectedRoute>} />
            <Route path="/assembly" element={<ProtectedRoute requiredRoles={['admin', 'assembler']}><Assembly /></ProtectedRoute>} />
            <Route path="/decoration" element={<ProtectedRoute requiredRoles={['admin', 'designer']}><Decoration /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute requiredRoles={['admin', 'delivery']}><Delivery /></ProtectedRoute>} />
            <Route path="/restock" element={<ProtectedRoute requiredRoles={['admin', 'baker', 'assembler', 'designer']}><Restock /></ProtectedRoute>} />
            <Route path="/cash-register" element={<ProtectedRoute requiredRoles={['admin']}><CashRegister /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredRoles={['admin']}><Users /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRoles={['admin']}><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
