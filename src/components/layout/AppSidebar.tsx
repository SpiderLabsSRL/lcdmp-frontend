import { useState } from 'react';
import { 
  Home, 
  ShoppingCart, 
  Package, 
  Warehouse, 
  Cake, 
  Users, 
  Calendar, 
  Truck, 
  CreditCard,
  Settings,
  ChefHat,
  Palette,
  Hammer,
  PackagePlus,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Inicio', href: '/dashboard' },
  { icon: ShoppingCart, label: 'Ventas', href: '/sales', roles: ['seller', 'admin'] },
  { icon: Package, label: 'Pedidos', href: '/orders', roles: ['seller', 'admin'] },
  { icon: Cake, label: 'Productos', href: '/products', roles: ['admin'] },
  { icon: Warehouse, label: 'Inventario', href: '/inventory', roles: ['admin', 'baker'] },
  { icon: Calendar, label: 'Menús Especiales', href: '/special-menus', roles: ['admin', 'seller'] },
  { icon: ChefHat, label: 'Hornos', href: '/baking', roles: ['baker', 'admin'] },
  { icon: Hammer, label: 'Armado', href: '/assembly', roles: ['assembler', 'admin'] },
  { icon: Palette, label: 'Decoración', href: '/decoration', roles: ['designer', 'admin'] },
  { icon: Truck, label: 'Delivery', href: '/delivery', roles: ['delivery', 'admin'] },
  { icon: PackagePlus, label: 'Reposición', href: '/restock', roles: ['admin', 'baker', 'assembler', 'designer'] },
  { icon: CreditCard, label: 'Caja', href: '/cash-register', roles: ['admin', 'seller'] },
  { icon: Users, label: 'Usuarios', href: '/users', roles: ['admin'] },
  { icon: Settings, label: 'Configuración', href: '/settings', roles: ['admin'] },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, hasAnyRole } = useAuth();
  const location = useLocation();

  const filteredNavItems = navItems.filter(item => 
    !item.roles || hasAnyRole(item.roles as any[])
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Logo */}
      <div className="p-6">
        <h1 className="font-display text-2xl font-bold text-sidebar-primary">
          La Casa de Mi Padre
        </h1>
        <p className="text-sm text-sidebar-foreground/60 mt-1">Repostería Artesanal</p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-primary font-medium"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User section */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 bg-sidebar-primary text-sidebar-primary-foreground">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
              {user ? getInitials(user.name) : '??'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.roles.map(r => {
                const roleNames: Record<string, string> = {
                  admin: 'Admin',
                  seller: 'Vendedor',
                  baker: 'Hornos',
                  designer: 'Diseño',
                  assembler: 'Armado',
                  delivery: 'Delivery'
                };
                return roleNames[r];
              }).join(', ')}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </Button>
      </div>
    </>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="fixed top-4 left-4 z-50 bg-background shadow-md"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="flex flex-col w-64 bg-sidebar text-sidebar-foreground h-screen fixed left-0 top-0">
      <SidebarContent />
    </aside>
  );
}
