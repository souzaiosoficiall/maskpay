import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell } from "lucide-react";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  title: string;
  description: string;
}

export function NotificationModal({ isOpen, onClose, title, description }: NotificationModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(dontShowAgain)}>
      <DialogContent className="bg-card border-white/5 rounded-[2.5rem] max-w-lg p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-500 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="bg-gradient-to-br from-white/10 to-transparent p-8 flex items-center gap-4 border-b border-white/5">
          <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-pulse">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none text-white">Aviso do Sistema</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-2">Comunicado Importante</p>
          </div>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-white rounded-full"></div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">{title}</h3>
            </div>
            <div className="text-sm text-muted-foreground/90 font-medium leading-relaxed max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar bg-white/[0.02] p-6 rounded-3xl border border-white/5">
              {description.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? "mt-3" : ""}>{line}</p>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all cursor-pointer" onClick={() => setDontShowAgain(!dontShowAgain)}>
            <Checkbox 
              id="dontShowAgain" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(!!checked)}
              className="w-5 h-5 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black rounded-lg transition-all"
            />
            <label 
              htmlFor="dontShowAgain"
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-white cursor-pointer select-none transition-colors"
            >
              Não mostrar este aviso novamente
            </label>
          </div>
        </div>

        <DialogFooter className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={() => onClose(dontShowAgain)}
            className="w-full bg-white text-black hover:bg-white/90 rounded-2xl py-7 text-xs font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
          >
            Fechar Comunicado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
