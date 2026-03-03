import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CarFront,
  Thermometer,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVehicles, deleteVehicle, upsertVehicle } from "@/lib/api/vehicles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";

export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [deleteVehicleId, setDeleteVehicleId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const vehicleForm = useForm({
    defaultValues: {
      code: "",
      plateNumber: "",
      vehicleType: "",
      capacity: undefined,
      costPerKm: undefined,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!editingVehicle) return;

    vehicleForm.reset({
      id: editingVehicle.id,
      code: editingVehicle.code ?? "",
      plateNumber: editingVehicle.plateNumber ?? "",
      vehicleType: editingVehicle.vehicleType ?? "",
      capacity: editingVehicle.capacity
        ? Number(editingVehicle.capacity)
        : undefined,
      costPerKm: editingVehicle.costPerKm
        ? Number(editingVehicle.costPerKm)
        : undefined,
      isActive: editingVehicle.isActive ?? true,
    });
  }, [editingVehicle, vehicleForm]);

  const queryClient = useQueryClient();

  const {
    data: vehicles,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
  });

  const upsertMutation = useMutation({
    mutationFn: upsertVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDialogOpen(false);
      setEditingVehicle(null);
      vehicleForm.reset();
    },
    onError: (err: any) => {
      if (err.field) {
        vehicleForm.setError(err.field, {
          message: err.message,
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  const onSubmit = (values: any) => {
    upsertMutation.mutate(values);
  };

  const filteredVehicles = vehicles?.filter((vehicle) => {
    const searchLower = search.toLowerCase();
    return (
      vehicle.code?.toLowerCase().includes(searchLower) ||
      vehicle.plateNumber?.toLowerCase().includes(searchLower) ||
      vehicle.vehicleType?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Vehicles
          </h1>
          <p className="text-muted-foreground">Manage delivery fleet</p>
        </div>

        <Button
          data-testid="button-add-vehicle"
          onClick={() => {
            setEditingVehicle(null);
            vehicleForm.reset({
              code: "",
              plateNumber: "",
              vehicleType: "",
              capacity: undefined,
              costPerKm: undefined,
              isActive: true,
            });
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                className="pl-9"
                data-testid="input-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Plate</TableHead>
                <TableHead>Vehicle Type</TableHead>
                <TableHead>Capacity (trays)</TableHead>
                <TableHead>Temp Control</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles?.map((vehicle) => (
                <TableRow
                  key={vehicle.id}
                  data-testid={`row-vehicle-${vehicle.id}`}
                >
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <CarFront className="w-4 h-4 text-muted-foreground" />
                      {vehicle.plateNumber}
                    </div>
                  </TableCell>
                  <TableCell>{vehicle.vehicleType}</TableCell>
                  <TableCell>{vehicle.capacity} trays</TableCell>
                  <TableCell>
                    {vehicle.tempControl ? (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Thermometer className="w-4 h-4" />
                        Yes
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vehicle.isActive ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {vehicle.isActive ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-edit-${vehicle.id}`}
                        onClick={() => {
                          setEditingVehicle(vehicle);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-${vehicle.id}`}
                        onClick={() => setDeleteVehicleId(vehicle.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingVehicle(null);
            vehicleForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? "แก้ไข Vehicle" : "เพิ่ม Vehicle"}
            </DialogTitle>
            <DialogDescription>
              Enter vehicle details for fleet management
            </DialogDescription>
          </DialogHeader>

          <Form {...vehicleForm}>
            <form
              className="space-y-4"
              onSubmit={vehicleForm.handleSubmit(onSubmit)}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={vehicleForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Code*</FormLabel>
                      <FormControl>
                        <Input placeholder="VHC-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={vehicleForm.control}
                  name="plateNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Plate*</FormLabel>
                      <FormControl>
                        <Input placeholder="1กข-1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={vehicleForm.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Type*</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="van">Van</SelectItem>
                          <SelectItem value="refrigerated">
                            Refrigerated
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={vehicleForm.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : e.target.value,
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={vehicleForm.control}
                  name="costPerKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost / KM</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="12.50"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : e.target.value,
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={vehicleForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit">
                  {editingVehicle ? "บันทึก" : "สร้าง"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteVehicleId !== null}
        onOpenChange={() => setDeleteVehicleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ Vehicle นี้?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() =>
                deleteVehicleId && deleteMutation.mutate(deleteVehicleId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-supplier"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
