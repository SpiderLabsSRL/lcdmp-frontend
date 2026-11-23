import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Loader2, Plus, Scissors, Search, Settings2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { getCakeShapeLabel } from '@/types/consts';
import { IBakedApi, defaultBakedApi } from '@/api/BakedApi';
import type { IOrdersApi } from '@/api/OrdersApi';
import type { BakedItem, DoughType } from '@/types';
import { BakedBatchDialog } from './BakedBatchDialog';
import { AdjustDialog, CutDialog, DoughTypesDialog, MovementsDialog, WasteDialog } from './BakedItemDialogs';

interface BakedInventoryTabProps {
  bakedApi?: IBakedApi;
  ordersApi?: IOrdersApi;
  // Para que la página refresque el aviso de stock bajo cuando cambia el inventario
  onChanged?: () => void;
}

// Inventario de masas horneadas: stock por tipo de masa + sabor + porciones (+ forma), con
// registro de tandas, merma, ajuste manual, historial y administración de los tipos de masa.
export function BakedInventoryTab({ bakedApi = defaultBakedApi, ordersApi, onChanged }: BakedInventoryTabProps) {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<BakedItem[]>([]);
  const [doughTypes, setDoughTypes] = useState<DoughType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 300);

  const [batchOpen, setBatchOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [wasteItem, setWasteItem] = useState<BakedItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<BakedItem | null>(null);
  const [cutItem, setCutItem] = useState<BakedItem | null>(null);
  const [historyItem, setHistoryItem] = useState<BakedItem | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await bakedApi.getItems({
        search: debouncedSearch || undefined,
        doughTypeId: typeFilter !== 'all' ? typeFilter : undefined,
      }));
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar el inventario horneado');
    } finally {
      setLoading(false);
    }
  }, [bakedApi, debouncedSearch, typeFilter]);

  const loadTypes = useCallback(() => {
    bakedApi.getDoughTypes().then(setDoughTypes).catch(() => toast.error('Error al cargar los tipos de masa'));
  }, [bakedApi]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadTypes(); }, [loadTypes]);

  const refresh = () => {
    loadItems();
    onChanged?.();
  };

  const handleDelete = async (item: BakedItem) => {
    if (!confirm(`¿Eliminar "${item.name}" y todo su historial? Los productos vinculados a esta masa quedarán sin vínculo.`)) return;
    try {
      await bakedApi.deleteItem(item.id);
      toast.success('Ítem eliminado');
      refresh();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el ítem');
    }
  };

  const isLow = (item: BakedItem) => item.quantity <= item.minStock;

  return (
    <div className="space-y-4">
      <Card className="mx-4 sm:mx-0">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
              <Input
                placeholder="Buscar por tipo o sabor..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por tipo de masa"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {doughTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setTypesOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2 shrink-0" /> Tipos<span className="hidden sm:inline">&nbsp;de masa</span>
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => setBatchOpen(true)}>
              <Plus className="h-4 w-4 mr-2 shrink-0" /> Registrar<span className="hidden sm:inline">&nbsp;horneado</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="mx-4 sm:mx-0">
          <CardContent className="p-8 text-center">No hay masas horneadas registradas</CardContent>
        </Card>
      ) : isMobile ? (
        // En móvil una tabla de 6 columnas obliga a desplazarse de lado para ver el stock:
        // una tarjeta por ítem, con sus acciones abajo.
        <div className="space-y-3 px-4">
          {items.map(item => {
            const low = isLow(item);
            const detail = itemDetail(item);
            return (
              <Card key={item.id} className={low ? 'border-destructive' : ''}>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{item.doughTypeName}</p>
                      {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
                    </div>
                    {low && <Badge variant="destructive" className="shrink-0">Bajo</Badge>}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 border-t pt-2">
                    <span className="text-sm text-muted-foreground">Stock</span>
                    <span>
                      <span className={`text-lg font-bold ${low ? 'text-destructive' : ''}`}>{item.quantity}</span>
                      <span className="text-xs text-muted-foreground"> / min {item.minStock}</span>
                    </span>
                  </div>

                  <ItemActions
                    item={item}
                    grow
                    onCut={setCutItem}
                    onAdjust={setAdjustItem}
                    onWaste={setWasteItem}
                    onHistory={setHistoryItem}
                    onDelete={handleDelete}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mx-4 sm:mx-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Masa</TableHead>
                  <TableHead>Sabor</TableHead>
                  <TableHead>Porciones</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.doughTypeName}</TableCell>
                    <TableCell>{item.flavor || '—'}</TableCell>
                    <TableCell>{item.portions ?? (item.isCuttable ? item.unitName : '—')}</TableCell>
                    <TableCell>{item.shape ? getCakeShapeLabel(item.shape) : '—'}</TableCell>
                    <TableCell>
                      <span className={isLow(item) ? 'text-destructive font-bold' : 'font-medium'}>{item.quantity}</span>
                      <span className="text-xs text-muted-foreground"> / mín {item.minStock}</span>
                      {isLow(item) && <Badge variant="destructive" className="ml-2">Bajo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <ItemActions
                        item={item}
                        onCut={setCutItem}
                        onAdjust={setAdjustItem}
                        onWaste={setWasteItem}
                        onHistory={setHistoryItem}
                        onDelete={handleDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <BakedBatchDialog open={batchOpen} onOpenChange={setBatchOpen} bakedApi={bakedApi} ordersApi={ordersApi} onSaved={refresh} />
      <DoughTypesDialog open={typesOpen} onOpenChange={setTypesOpen} bakedApi={bakedApi} onChanged={() => { loadTypes(); refresh(); }} />
      <WasteDialog item={wasteItem} bakedApi={bakedApi} onClose={() => setWasteItem(null)} onSaved={refresh} />
      <CutDialog item={cutItem} bakedApi={bakedApi} onClose={() => setCutItem(null)} onSaved={refresh} />
      <AdjustDialog item={adjustItem} bakedApi={bakedApi} onClose={() => setAdjustItem(null)} onSaved={refresh} />
      <MovementsDialog item={historyItem} bakedApi={bakedApi} onClose={() => setHistoryItem(null)} />
    </div>
  );
}

// Sabor | porciones (o la unidad entera de una masa que se corta) | forma
function itemDetail(item: BakedItem): string {
  return [
    item.flavor || null,
    item.portions ? `${item.portions} porciones` : (item.isCuttable ? item.unitName : null),
    item.shape ? getCakeShapeLabel(item.shape) : null,
  ].filter(Boolean).join(' · ');
}

interface ItemActionsProps {
  item: BakedItem;
  // En movil los botones con texto se reparten el ancho; en la tabla van compactos a la derecha.
  grow?: boolean;
  onCut: (item: BakedItem) => void;
  onAdjust: (item: BakedItem) => void;
  onWaste: (item: BakedItem) => void;
  onHistory: (item: BakedItem) => void;
  onDelete: (item: BakedItem) => void;
}

function ItemActions({ item, grow, onCut, onAdjust, onWaste, onHistory, onDelete }: ItemActionsProps) {
  const textButton = grow ? 'flex-1 min-w-[6rem]' : '';
  return (
    <div className={grow ? 'flex flex-wrap gap-2 pt-1' : 'flex justify-end gap-1 flex-wrap'}>
      {item.isCuttable && item.portions === null && (
        <Button variant="outline" size="sm" className={textButton} onClick={() => onCut(item)} aria-label={`Cortar ${item.name}`}>
          <Scissors className="h-4 w-4 mr-1" /> Cortar
        </Button>
      )}
      <Button variant="outline" size="sm" className={textButton} onClick={() => onAdjust(item)} aria-label={`Ajustar ${item.name}`}>
        <SlidersHorizontal className="h-4 w-4 mr-1" /> Ajustar
      </Button>
      <Button variant="outline" size="sm" className={textButton} onClick={() => onWaste(item)} aria-label={`Merma de ${item.name}`}>
        Merma
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => onHistory(item)} aria-label={`Historial de ${item.name}`} title="Historial">
        <History className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => onDelete(item)} aria-label={`Eliminar ${item.name}`} title="Eliminar">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
